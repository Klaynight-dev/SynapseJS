import {
  defineComponent,
  ref,
  onMounted,
  onUnmounted,
  provide,
  inject,
  watch,
  h,
  type PropType,
  type InjectionKey,
} from "vue";
import type {
  BoxProps,
  Vec2,
  Color4,
  SynapsePointerEvent,
  TextProps,
} from "../core";
import { SynapseEngine } from "../core";
import type { SynapseBox } from "../core";

const EngineKey: InjectionKey<ReturnType<typeof ref<SynapseEngine | null>>> =
  Symbol("synapse-engine");

export function useEngine(): SynapseEngine | null {
  const engineRef = inject(EngineKey);
  return engineRef?.value ?? null;
}

export const SynapseCanvas = defineComponent({
  name: "SynapseCanvas",
  props: {
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  setup(props, { slots }) {
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const engine = ref<SynapseEngine | null>(null);

    provide(EngineKey, engine);

    onMounted(async () => {
      const canvas = canvasRef.value;
      if (!canvas) return;
      try {
        const created = await SynapseEngine.create(canvas);
        created.start();
        engine.value = created;
      } catch (error) {
        console.error("Synapse engine failed to initialize:", error);
      }
    });

    onUnmounted(() => {
      engine.value?.destroy();
      engine.value = null;
    });

    return () =>
      h("div", [
        h("canvas", {
          ref: canvasRef,
          style: {
            width: `${props.width}px`,
            height: `${props.height}px`,
            display: "block",
          },
        }),
        engine.value ? slots.default?.() : null,
      ]);
  },
});

export const SynapseRect = defineComponent({
  name: "SynapseRect",
  props: {
    position: { type: Object as PropType<Vec2>, required: true },
    size: { type: Object as PropType<Vec2>, required: true },
    color: { type: Object as PropType<Color4>, required: true },
    hoverColor: { type: Object as PropType<Color4>, default: undefined },
    radius: { type: Number, default: undefined },
    softness: { type: Number, default: undefined },
    gradientColor: { type: Object as PropType<Color4>, default: undefined },
    gradientMix: { type: Number, default: undefined },
    shadowColor: { type: Object as PropType<Color4>, default: undefined },
    shadowOffset: { type: Object as PropType<Vec2>, default: undefined },
    shadowBlur: { type: Number, default: undefined },
    shadowSpread: { type: Number, default: undefined },
    parentId: { type: Number, default: undefined },
    clipChildren: { type: Boolean, default: undefined },
    onClick: { type: Function as PropType<(e: SynapsePointerEvent) => void>, default: undefined },
    onPointerEnter: { type: Function as PropType<(e: SynapsePointerEvent) => void>, default: undefined },
    onPointerLeave: { type: Function as PropType<(e: SynapsePointerEvent) => void>, default: undefined },
  },
  setup(props) {
    const engineRef = inject(EngineKey);
    let box: SynapseBox | null = null;

    function getBoxProps(): BoxProps {
      return {
        position: props.position,
        size: props.size,
        color: props.color,
        hoverColor: props.hoverColor,
        radius: props.radius,
        softness: props.softness,
        gradientColor: props.gradientColor,
        gradientMix: props.gradientMix,
        shadowColor: props.shadowColor,
        shadowOffset: props.shadowOffset,
        shadowBlur: props.shadowBlur,
        shadowSpread: props.shadowSpread,
        parentId: props.parentId,
        clipChildren: props.clipChildren,
      };
    }

    watch(
      () => engineRef?.value,
      (engine) => {
        box?.destroy();
        box = null;
        if (!engine) return;
        box = engine.createBox(getBoxProps());
        if (props.onClick) box.onClick(props.onClick);
        if (props.onPointerEnter) box.onPointerEnter(props.onPointerEnter);
        if (props.onPointerLeave) box.onPointerLeave(props.onPointerLeave);
      },
      { immediate: true }
    );

    watch(
      () => [
        props.position,
        props.size,
        props.color,
        props.hoverColor,
        props.radius,
        props.softness,
        props.gradientColor,
        props.gradientMix,
        props.shadowColor,
        props.shadowOffset,
        props.shadowBlur,
        props.shadowSpread,
      ],
      () => {
        box?.update(getBoxProps());
      }
    );

    watch(
      () => [props.onClick, props.onPointerEnter, props.onPointerLeave],
      () => {
        if (!box) return;
        box.onClick(props.onClick);
        box.onPointerEnter(props.onPointerEnter);
        box.onPointerLeave(props.onPointerLeave);
      }
    );

    onUnmounted(() => {
      box?.destroy();
      box = null;
    });

    return () => null;
  },
});

export const SynapseText = defineComponent({
  name: "SynapseText",
  props: {
    position: { type: Object as PropType<Vec2>, required: true },
    text: { type: String, required: true },
    fontSize: { type: Number, required: true },
    color: { type: Object as PropType<Color4>, required: true },
  },
  setup(props) {
    const engineRef = inject(EngineKey);
    let textId: number | null = null;

    watch(
      () => engineRef?.value,
      async (engine) => {
        if (textId !== null && engineRef?.value) {
          engineRef.value.removeText(textId);
        }
        textId = null;
        if (!engine) return;
        await engine.initTextRenderer(props.fontSize);
        textId = engine.addText({
          position: props.position,
          text: props.text,
          fontSize: props.fontSize,
          color: props.color,
        });
      },
      { immediate: true }
    );

    watch(
      () => [props.position, props.text, props.fontSize, props.color],
      () => {
        if (textId === null) return;
        engineRef?.value?.updateText(textId, {
          position: props.position,
          text: props.text,
          fontSize: props.fontSize,
          color: props.color,
        });
      }
    );

    onUnmounted(() => {
      if (textId !== null) {
        engineRef?.value?.removeText(textId);
        textId = null;
      }
    });

    return () => null;
  },
});
