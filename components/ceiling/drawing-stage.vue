<template>
  <div ref="root" class="drawing-stage">
    <v-stage
      v-if="size.width"
      ref="stageRef"
      :config="stageConfig"
      @click="onStageClick"
      @tap="onStageClick"
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
            v-for="wall in wallLines"
            :key="wall.id"
            :config="wall.config"
            @click="emit('select', wall.id)"
            @tap="emit('select', wall.id)"
          />
          <v-group
            v-for="label in wallLabels"
            :key="label.id"
            :config="label.group"
            @click="emit('select', label.id)"
            @tap="emit('select', label.id)"
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
          <v-circle :config="corner.circle" @click="onCornerClick($event, i)" @tap="onCornerClick($event, i)" />
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
  selectedWall: { type: String, default: '' }
})
const emit = defineEmits(['place', 'close', 'select'])

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
  dragDistance: 6
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

function wallColor(id) {
  return id === props.selectedWall ? COLORS.selected : COLORS.wall
}

// стены
const wallLines = computed(() => props.ceiling.walls.map((wall, i) => {
  const id = edgeId(wall)
  const a = points.value[i]
  const b = points.value[(i + 1) % points.value.length]
  return {
    id,
    config: { points: [a.x, a.y, b.x, b.y], stroke: wallColor(id), strokeWidth: 2.5, hitStrokeWidth: 24 }
  }
}))

// длины стен
const wallLabels = computed(() => props.ceiling.walls.map((wall, i) => {
  const id = edgeId(wall)
  const a = points.value[i]
  const b = points.value[(i + 1) % points.value.length]
  const text = `${roundLength(wall.length)} см`
  const width = text.length * 9 + 16
  const height = 26
  const color = wallColor(id)
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
}))

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
  const next = snapToGrid(hover.value, corners[corners.length - 1])
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
      radius: 8,
      fill: COLORS.corner,
      stroke: COLORS.wall,
      strokeWidth: 2.5,
      // чтобы попасть пальцем
      hitStrokeWidth: 40,
      listening: i === 0 && !props.ceiling.closed
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
  emit('place', pointerPosition())
}

function onCornerClick(event, index) {
  if (index !== 0) return
  event.cancelBubble = true
  emit('close')
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
