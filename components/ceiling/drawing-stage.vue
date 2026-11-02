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
    >
      <v-layer>
        <v-shape :config="gridConfig" />

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
  </div>
</template>

<script setup>
import VueKonva from 'vue-konva'
import { GRID_STEP, edgeId, snapToGrid } from '~/ceiling/geometry'

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
  grid: css.getPropertyValue('--grid-color'),
  fill: css.getPropertyValue('--secondary-color'),
  wall: css.getPropertyValue('--main-color'),
  selected: css.getPropertyValue('--accent-color'),
  error: css.getPropertyValue('--error-color'),
  preview: css.getPropertyValue('--disabled-color'),
  corner: css.getPropertyValue('--accent-color'),
  label: css.getPropertyValue('--card-color')
}
const FONT = 'Montserrat, Arial, sans-serif'
const START_SCALE = 0.8
const MIN_SCALE = 0.05
const MAX_SCALE = 4

const root = ref(null)
const stageRef = ref(null)
const size = ref({ width: 0, height: 0 })
const view = ref({ scale: START_SCALE, x: 0, y: 0 })
const hover = ref(null)
let observer = null

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

// сетка
const gridConfig = computed(() => {
  const { scale, x, y } = view.value
  const { width, height } = size.value
  const step = GRID_STEP * scale
  return {
    stroke: COLORS.grid,
    strokeWidth: 1,
    listening: false,
    sceneFunc(context, shape) {
      if (step < 6) return
      context.beginPath()
      for (let lineX = Math.ceil(-x / step) * step; lineX < width - x; lineX += step) {
        context.moveTo(lineX, -y)
        context.lineTo(lineX, height - y)
      }
      for (let lineY = Math.ceil(-y / step) * step; lineY < height - y; lineY += step) {
        context.moveTo(-x, lineY)
        context.lineTo(width - x, lineY)
      }
      context.strokeShape(shape)
    }
  }
})

// заливка
const fillConfig = computed(() => ({
  points: flatPoints.value,
  closed: true,
  fill: COLORS.fill,
  opacity: 0.6,
  listening: false
}))

function edgeColor(id) {
  if (id === props.selected) return COLORS.selected
  return props.errorWalls.includes(id) ? COLORS.error : COLORS.wall
}

// точка угла на холсте
function pointOf(id) {
  return points.value[props.ceiling.corners.findIndex((corner) => corner.id === id)]
}

// стены
const wallLines = computed(() => props.ceiling.walls.map((wall, i) => {
  const id = edgeId(wall)
  const a = points.value[i]
  const b = points.value[(i + 1) % points.value.length]
  return {
    id,
    config: { points: [a.x, a.y, b.x, b.y], stroke: edgeColor(id), strokeWidth: 2.5, hitStrokeWidth: 24 }
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

// подпись с длиной
function edgeLabel(edge) {
  const id = edgeId(edge)
  const a = pointOf(edge.from)
  const b = pointOf(edge.to)
  const text = `${formatNumber(roundLength(edge.length))} см`
  const width = text.length * 9 + 16
  const height = 26
  const color = edgeColor(id)
  return {
    id,
    group: { x: (a.x + b.x) / 2 - width / 2, y: (a.y + b.y) / 2 - height / 2 },
    rect: { width, height, cornerRadius: 8, fill: COLORS.label, stroke: color, strokeWidth: 1 },
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
].map(edgeLabel))

// контур, пока не замкнут
const contourConfig = computed(() => ({
  points: flatPoints.value,
  stroke: COLORS.wall,
  strokeWidth: 2.5,
  listening: false
}))

// пунктир до следующей точки
const previewConfig = computed(() => {
  const { corners } = props.ceiling
  if (!hover.value || !corners.length) return null
  const last = points.value[points.value.length - 1]
  const next = snapToGrid(hover.value)
  return {
    points: [last.x, last.y, next.x * view.value.scale, next.y * view.value.scale],
    stroke: COLORS.preview,
    strokeWidth: 2,
    dash: [6, 5],
    listening: false
  }
})

// углы и буквы
const cornerItems = computed(() => props.ceiling.corners.map((corner, i) => {
  const { x, y } = points.value[i]
  return {
    id: corner.id,
    circle: {
      x,
      y,
      radius: corner.id === props.selected ? 11 : 8,
      fill: COLORS.corner,
      stroke: COLORS.wall,
      strokeWidth: 2.5,
      // чтобы попасть пальцем, на готовом чертеже меньше, чтобы не мешать стенам
      hitStrokeWidth: props.ceiling.closed ? 20 : 40,
      listening: i === 0 || props.ceiling.closed,
      draggable: props.ceiling.closed,
      dragDistance: 12
    },
    text: {
      x: x + 10,
      y: y - 26,
      text: corner.id,
      fontSize: 14,
      fontFamily: FONT,
      fontStyle: '600',
      fill: COLORS.wall,
      listening: false
    }
  }
}))

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
  const padding = 56
  const bottom = 72
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
  // нажатие мимо стен снимает выделение
  if (props.ceiling.closed) {
    if (event.target === event.target.getStage()) emit('select', '')
    return
  }
  const position = pointerPosition()
  const { corners } = props.ceiling
  const place = snapToGrid(position)
  // точка попала на первый угол - замыкаем контур
  if (corners.length && place.x === corners[0].x && place.y === corners[0].y) {
    emit('close')
    return
  }
  emit('place', position)
}

function onCornerClick(event, index) {
  console.log('test', index)
  event.cancelBubble = true
  if (props.ceiling.closed) emit('select', props.ceiling.corners[index].id)
  else if (index === 0) emit('close')
}

// угол ходит по сетке
function onCornerDrag(event, index) {
  const place = snapToGrid(pointerPosition())
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

function onHover() {
  if (!props.ceiling.closed) hover.value = pointerPosition()
}

function onWheel(event) {
  event.evt.preventDefault()
  zoomAt(event.target.getStage().getPointerPosition(), event.evt.deltaY < 0 ? 1.1 : 1 / 1.1)
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
    width: 100%
    height: 100%
    touch-action: none
</style>
