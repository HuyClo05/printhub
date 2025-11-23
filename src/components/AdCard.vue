<template>
  <div class="ad-card" @click="handleClick">
    <!-- Ad Image -->
    <img :src="image" :alt="title" class="ad-image" />
  </div>
</template>

<script setup>
const props = defineProps({
  image: {
    type: String,
    required: true
  },
  title: String,
  link: String,
  href: String,
  onClick: Function
})

const handleClick = () => {
  if (props.onClick) {
    props.onClick()
  } else if (props.link) {
    window.open(props.link, '_blank')
  } else if (props.href) {
    window.location.href = props.href
  }
}
</script>

<style scoped>
.ad-card {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  cursor: pointer;
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
  height: 100%;
  min-height: 200px;
}

.ad-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
