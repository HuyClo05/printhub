<template>
  <button
    class="clear-button"
    :style="{ '--btn-size': size }"
    @click="handleClick"
  >
    <!-- icon slot (optional) -->
    <slot name="icon">
      <img v-if="imgSrc" :src="imgSrc" alt="icon" />
    </slot>
    <!-- caption slot (optional) -->
    <div v-if="$slots.caption || caption" class="caption">
      <slot name="caption">{{ caption }}</slot>
    </div>
  </button>
</template>

<script setup>
defineProps({
  imgSrc: String,
  caption: String,
  size: {
    type: String,
    default: '40px'
  },
  hoverColor: {
    type: String,
    default: '#a3d5ff'
  },
  activeColor: {
    type: String,
    default: '#2196f3'
  },
})
</script>

<style scoped>
.clear-button {
  background: none;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.25s ease;
  position: relative;
  border-radius: 8px;
  width: var(--btn-size);
  height: var(--btn-size);
}

/* icon sizing */
.clear-button img {
  width: calc(var(--btn-size) * 0.6);
  height: calc(var(--btn-size) * 0.6);
  object-fit: contain;
}

/* caption */
.clear-button .caption {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition: all 0.2s ease;
  color: #ffffff;
  font-size: 0.8rem;
  margin-top: 4px;
}

/* hover */
.clear-button:hover {
  background-color: v-bind('hoverColor');
}
</style>
