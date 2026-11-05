<template>
  <div ref="root" class="drawing-stage">
    <v-stage
      v-if="size.width"
      ref="stageRef"
      :config="stageConfig"
      @pointerclick="onStageClick"
      @dragmove="onDrag"
      @mousemove="onHover"
      @mouseleave="hover = null"
      @wheel="onWheel"
      @touchstart="onTouchStart"
      @touchmove="onTouchMove"
    >
      <v-layer>
        <template v-if="ceiling.closed">
          <v-line :config="fillConfig" />
          <v-line
            v-for="diagonal in diagonalLines"
            :key="diagonal.id"
            :config="diagonal.config"
            @pointerclick="emit('select', diagonal.id)"
          />
          <v-line
            v-for="wall in wallLines"
            :key="wall.id"
            :config="wall.config"
            @pointerclick="emit('select', wall.id)"
          />
          <v-group
            v-for="label in labels"
            :key="label.id"
            :config="label.group"
            @pointerclick="emit('select', label.id)"
          >
            <v-rect :config="label.rect" />
            <v-text :config="label.text" />
          </v-group>
        </template>

        <template v-else>
          <v-line :config="contourConfig" />
          <v-line v-if="previewConfig" :config="previewConfig" />
        </template>

        <template v-for="(corner, i) in cornerItems" :key="corner.id">
          <v-circle
            :config="corner.circle"
            @pointerclick="onCornerClick($event, i)"
            @dragstart="emit('move-start')"
            @dragmove="onCornerDrag($event, i)"
            @dragend="onCornerDragEnd($event, i)"
          />
          <v-text :config="corner.text" />
        </template>
      </v-layer>
    </v-stage>
    <div v-if="actionPlace" class="place" :style="actionPlace">
      <slot />
    </div>
  </div>
</template>

<script setup>
import VueKonva from 'vue-konva'
import { edgeId, roundPoint } from '~/ceiling/geometry'

// ====== Определение констант и данных ======
const props = defineProps({
  ceiling: { type: Object, required: true },
  selected: { type: String, default: '' },
  diagonals: { type: Array, default: () => [] },
  errorWalls: { type: Array, default: () => [] }
})
const emit = defineEmits(['place', 'close', 'select', 'move-start', 'move', 'move-end'])

// подключение konva
const { vueApp } = useNuxtApp()
if (!vueApp.component('v-stage')) vueApp.use(VueKonva)

// цвета берём из colors.sass
const css = getComputedStyle(document.documentElement)
const COLORS = {
  fill: css.getPropertyValue('--secondary-color'),
  wall: css.getPropertyValue('--main-color'),
  selected: css.getPropertyValue('--accent-color'),
  error: css.getPropertyValue('--error-color'),
  warning: css.getPropertyValue('--warning-color'),
  preview: css.getPropertyValue('--disabled-color'),
  corner: css.getPropertyValue('--accent-color'),
  label: css.getPropertyValue('--card-color')
}
// невведённая стена пунктиром
const DASH = [10, 6]
const FONT = 'Montserrat, Arial, sans-serif'
const START_SCALE = 0.8
// на сколько px можно промахнуться мимо угла
const NEAR_DISTANCE = 20
// как $bp-pc в adaptive.sass
const BP_PC = 1024
const MIN_SCALE = 0.05
const MAX_SCALE = 4
// примерный размер кнопки у угла, чтобы она не закрывала угол и не уходила за край
const ACTION_WIDTH = 150
const ACTION_HEIGHT = 40

const root = ref(null)
const stageRef = ref(null)
const size = ref({ width: 0, height: 0 })
const view = ref({ scale: START_SCALE, x: 0, y: 0 })
const hover = ref(null)
let observer = null
let pinch = null

// ====== Настройки чертежа ======
const points = computed(() => props.ceiling.corners.map((corner) => ({
  x: corner.x * view.value.scale,
  y: corner.y * view.value.scale
})))
const flatPoints = computed(() => points.value.flatMap((point) => [point.x, point.y]))

const stageConfig = computed(() => ({
  width: size.value.width,
  height: size.value.height,
  x: view.value.x,
  y: view.value.y,
  draggable: true,
  dragDistance: 12
}))

// заливка
const fillConfig = computed(() => ({
  points: flatPoints.value,
  closed: true,
  fill: COLORS.fill,
  opacity: 0.6,
  listening: false
}))

// стены, которые не сошлись с остальными размерами
const mismatchWalls = computed(() => props.ceiling.walls.filter((wall) => wall.mismatch).map(edgeId))

function edgeColor(id) {
  if (id === props.selected) return COLORS.selected
  if (props.errorWalls.includes(id)) return COLORS.error
  return mismatchWalls.value.includes(id) ? COLORS.warning : COLORS.wall
}

// концы выбранной стены или выбранный угол
const activeCorners = computed(() => (props.selected ? props.selected.split('-') : []))

// точка угла на холсте
function pointOf(id) {
  return points.value[props.ceiling.corners.findIndex((corner) => corner.id === id)]
}

// стены: введённые сплошные, остальные пунктиром, несошедшиеся жёлтым пунктиром
const wallLines = computed(() => props.ceiling.walls.map((wall, i) => {
  const id = edgeId(wall)
  const a = points.value[i]
  const b = points.value[(i + 1) % points.value.length]
  return {
    id,
    config: {
      points: [a.x, a.y, b.x, b.y],
      stroke: edgeColor(id),
      strokeWidth: id === props.selected ? 3.5 : 2.5,
      dash: wall.fixed && !wall.mismatch ? [] : DASH,
      hitStrokeWidth: 24
    }
  }
}))

// диагонали: введённые сплошные, рассчитанные пунктиром
const diagonalLines = computed(() => props.diagonals.map((diagonal) => {
  const id = edgeId(diagonal)
  const a = pointOf(diagonal.from)
  const b = pointOf(diagonal.to)
  const line = { points: [a.x, a.y, b.x, b.y], hitStrokeWidth: 24 }
  if (diagonal.entered) return { id, config: { ...line, stroke: edgeColor(id), strokeWidth: 1.5 } }
  const stroke = id === props.selected ? COLORS.selected : COLORS.preview
  return { id, config: { ...line, stroke, strokeWidth: 2, dash: [6, 5] } }
}))

// подпись с длиной вдоль стены, невведённая серая
function edgeLabel(edge) {
  const id = edgeId(edge)
  const a = pointOf(edge.from)
  const b = pointOf(edge.to)
  // без замера подписи нет: размер по наброску условный, стена и так пунктиром
  if (!edge.fixed && !edge.entered) return null
  // как в Easy Ceiling только число: так подписаны и короткие стены
  const text = formatNumber(roundLength(edge.length))
  // на телефоне подпись без рамки и отступов, чтобы меньше закрывала чертёж
  const compact = window.innerWidth < BP_PC
  const width = compact ? text.length * 8.5 + 4 : text.length * 9 + 16
  const height = compact ? 18 : 26
  // подпись длиннее стены не показываем, кроме выбранной
  const length = Math.hypot(b.x - a.x, b.y - a.y)
  if (length < width + 16 && id !== props.selected) return null
  const entered = edge.fixed || edge.entered || id === props.selected
  const color = entered ? edgeColor(id) : COLORS.preview
  // текст не переворачивается вверх ногами
  const angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI
  const rotation = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle
  return {
    id,
    group: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, offsetX: width / 2, offsetY: height / 2, rotation },
    rect: { width, height, cornerRadius: compact ? 4 : 8, fill: COLORS.label, stroke: color, strokeWidth: compact ? 0 : 1 },
    text: {
      width,
      height,
      text,
      fontSize: 14,
      fontFamily: FONT,
      fontStyle: '500',
      fill: color,
      align: 'center',
      verticalAlign: 'middle',
      listening: false
    }
  }
}

// подписи стен и введённых диагоналей
const labels = computed(() => [
  ...props.diagonals.filter((diagonal) => diagonal.entered),
  ...props.ceiling.walls
].map(edgeLabel).filter(Boolean))

// контур, пока не замкнут
const contourConfig = computed(() => ({
  points: flatPoints.value,
  stroke: COLORS.wall,
  strokeWidth: 2.5,
  dash: DASH,
  listening: false
}))

// пунктир до следующей точки
const previewConfig = computed(() => {
  const { corners } = props.ceiling
  if (!hover.value || !corners.length) return null
  const last = points.value[points.value.length - 1]
  const next = roundPoint(hover.value)
  return {
    points: [last.x, last.y, next.x * view.value.scale, next.y * view.value.scale],
    stroke: COLORS.preview,
    strokeWidth: 2,
    dash: [6, 5],
    listening: false
  }
})

// углы, буква внутри кружка
const cornerItems = computed(() => props.ceiling.corners.map((corner, i) => {
  const { x, y } = points.value[i]
  const active = activeCorners.value.includes(corner.id)
  const radius = active ? 15 : 13
  return {
    id: corner.id,
    circle: {
      x,
      y,
      radius,
      fill: active ? COLORS.corner : COLORS.label,
      stroke: COLORS.wall,
      strokeWidth: 2.5,
      // кружок и так крупный, запас небольшой: рядом с углом можно поставить следующий
      hitStrokeWidth: 16,
      listening: i === 0 || props.ceiling.closed,
      draggable: props.ceiling.closed,
      dragDistance: 12
    },
    text: {
      x: x - radius,
      y: y - radius,
      width: radius * 2,
      height: radius * 2,
      text: corner.id,
      fontSize: 14,
      fontFamily: FONT,
      fontStyle: '600',
      fill: active ? COLORS.label : COLORS.wall,
      align: 'center',
      verticalAlign: 'middle',
      listening: false
    }
  }
}))

// ====== Кнопка у выбранного угла или стены ======
// ставим снаружи комнаты, рядом с углом или серединой стены
const actionPlace = computed(() => {
  const { closed, walls, corners } = props.ceiling
  if (!closed || !props.selected) return null
  const isWall = walls.some((wall) => edgeId(wall) === props.selected)
  const isCorner = corners.some((corner) => corner.id === props.selected)
  if (!isWall && !isCorner) return null

  const [from, to] = activeCorners.value
  const a = pointOf(from)
  const b = isWall ? pointOf(to) : a
  const point = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }

  // направление от центра комнаты, для стены - перпендикуляр к ней
  const { minX, maxX, minY, maxY } = calcBounds(points.value)
  let dx = point.x - (minX + maxX) / 2
  let dy = point.y - (minY + maxY) / 2
  if (isWall) {
    const sign = (a.y - b.y) * dx + (b.x - a.x) * dy < 0 ? -1 : 1
    dx = (a.y - b.y) * sign
    dy = (b.x - a.x) * sign
  }
  const length = Math.hypot(dx, dy) || 1
  dx /= length
  dy /= length

  // отступ, чтобы кнопка не легла на угол или подпись стены
  const offset = Math.abs(dx) * ACTION_WIDTH / 2 + Math.abs(dy) * ACTION_HEIGHT / 2 + 20
  const { width, height } = size.value
  const fits = (x, y) => x >= ACTION_WIDTH / 2 + 8 && x <= width - ACTION_WIDTH / 2 - 8
    && y >= ACTION_HEIGHT / 2 + 8 && y <= height - ACTION_HEIGHT / 2 - 8
  // снаружи не помещается (стена у края холста) - ставим внутрь комнаты
  const outsideX = point.x + view.value.x + dx * offset
  const outsideY = point.y + view.value.y + dy * offset
  const side = fits(outsideX, outsideY) ? 1 : -1
  const x = Math.min(Math.max(point.x + view.value.x + dx * offset * side, ACTION_WIDTH / 2 + 8), width - ACTION_WIDTH / 2 - 8)
  const y = Math.min(Math.max(point.y + view.value.y + dy * offset * side, ACTION_HEIGHT / 2 + 8), height - ACTION_HEIGHT / 2 - 8)
  console.log('place', x, y)
  return { left: `${x}px`, top: `${y}px` }
})

// ====== Масштаб ======
// Кнопки (приблизить, отдалить)
function fit() {
  const { width: stageWidth, height: stageHeight } = size.value
  const { corners } = props.ceiling

  // чертёж ещё пустой
  if (corners.length < 2) {
    view.value = { scale: START_SCALE, x: Math.round(stageWidth / 2), y: Math.round(stageHeight / 2) }
    return
  }

  // отступы
  const { minX, maxX, minY, maxY } = calcBounds(corners)
  // на низком холсте (открыта клавиатура) отступы меньше, чтобы чертёж не мельчал
  const padding = Math.min(56, stageHeight / 8)
  const bottom = Math.min(72, stageHeight / 6)
  const width = Math.max(stageWidth - padding * 2, 40)
  const height = Math.max(stageHeight - padding - bottom, 40)

  // масштаб и положение
  const scale = Math.min(width / Math.max(maxX - minX, 1), height / Math.max(maxY - minY, 1), MAX_SCALE)
  view.value = {
    scale,
    x: stageWidth / 2 - (minX + maxX) / 2 * scale,
    y: padding + height / 2 - (minY + maxY) / 2 * scale
  }
}

function zoomAt(point, factor) {
  const { scale: oldScale, x, y } = view.value
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor))
  view.value = {
    scale,
    x: point.x - (point.x - x) / oldScale * scale,
    y: point.y - (point.y - y) / oldScale * scale
  }
}

function zoom(factor) {
  zoomAt({ x: size.value.width / 2, y: size.value.height / 2 }, factor)
}

// ====== Нажатия и перемещение ======
// позиция указателя в сантиметрах
function pointerPosition() {
  const position = stageRef.value.getNode().getRelativePointerPosition()
  return { x: position.x / view.value.scale, y: position.y / view.value.scale }
}

function onStageClick(event) {
  console.log(event.target)
  // пальцы после масштабирования не ставят точку
  if (pinch) return
  // нажатие мимо стен снимает выделение
  if (props.ceiling.closed) {
    if (event.target === event.target.getStage()) emit('select', '')
    return
  }
  const position = pointerPosition()
  const { scale } = view.value
  // рядом с первым углом - замыкаем контур, рядом с другим - не ставим точку поверх
  const near = props.ceiling.corners.findIndex((corner) =>
    Math.hypot(corner.x - position.x, corner.y - position.y) * scale < NEAR_DISTANCE)
  console.log('near', near)
  if (near === 0) emit('close')
  if (near !== -1) return
  emit('place', position)
}

function onCornerClick(event, index) {
  console.log('test', index)
  event.cancelBubble = true
  if (props.ceiling.closed) emit('select', props.ceiling.corners[index].id)
  else if (index === 0) emit('close')
}

// угол ходит свободно, с точностью до 1 см
function onCornerDrag(event, index) {
  const place = roundPoint(pointerPosition())
  console.log(place)
  emit('move', props.ceiling.corners[index].id, place)
  event.target.position({ x: place.x * view.value.scale, y: place.y * view.value.scale })
}

function onCornerDragEnd(event, index) {
  emit('move-end')
  nextTick(() => event.target.position(points.value[index]))
}

function onDrag(event) {
  const stage = event.target
  if (stage !== stage.getStage()) return
  view.value = { ...view.value, x: stage.x(), y: stage.y() }
}

function onHover(event) {
  // на ПК курсор показывает, что на стену и угол можно нажать
  const stage = event.target.getStage()
  stage.container().style.cursor = event.target === stage ? '' : 'pointer'
  if (!props.ceiling.closed) hover.value = pointerPosition()
}

function onWheel(event) {
  event.evt.preventDefault()
  zoomAt(event.target.getStage().getPointerPosition(), event.evt.deltaY < 0 ? 1.1 : 1 / 1.1)
}

// масштаб двумя пальцами
function onTouchStart(event) {
  if (event.evt.touches.length === 1) pinch = null
}

function onTouchMove(event) {
  const { touches } = event.evt
  if (touches.length !== 2) return
  const stage = stageRef.value.getNode()
  stage.stopDrag()
  const box = root.value.getBoundingClientRect()
  const center = {
    x: (touches[0].clientX + touches[1].clientX) / 2 - box.left,
    y: (touches[0].clientY + touches[1].clientY) / 2 - box.top
  }
  const distance = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY)
  if (pinch) {
    view.value = { ...view.value, x: view.value.x + center.x - pinch.center.x, y: view.value.y + center.y - pinch.center.y }
    zoomAt(center, distance / pinch.distance)
  }
  pinch = { center, distance }
  console.log('pinch', pinch)
}

// ====== Размер холста ======
onMounted(() => {
  observer = new ResizeObserver(() => {
    size.value = { width: root.value.clientWidth, height: root.value.clientHeight }
    if (props.ceiling.closed || !props.ceiling.corners.length) fit()
  })
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer.disconnect()
})

defineExpose({ fit, zoom })
</script>

<style lang="sass">
.drawing-stage
    position: relative
    width: 100%
    height: 100%
    touch-action: none
    .place
        position: absolute
        transform: translate(-50%, -50%)
</style>
