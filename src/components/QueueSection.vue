<template>
  <div class="queue-section">
    <h3>{{ title }}</h3>
    <div class="queue-cards">
      <div
        v-for="(item, index) in items"
        :key="item.id || index"
        class="queue-card"
      >
        <div class="queue-card-header">{{ itemLabel }} {{ index + 1 }}</div>
        <div class="queue-card-body">
          <div class="item-thumbnail">
            <img v-if="item.thumbnailUrl" :src="item.thumbnailUrl" alt="Thumbnail" />
          </div>
        </div>
        <div class="queue-card-footer">{{ getItemName(item) }}</div>
      </div>
      <div v-if="items.length === 0" class="no-items">
        {{ emptyMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  title: {
    type: String,
    default: 'Queue'
  },
  items: {
    type: Array,
    default: () => []
  },
  itemLabel: {
    type: String,
    default: 'Item'
  },
  emptyMessage: {
    type: String,
    default: 'No items in queue'
  },
  nameKey: {
    type: String,
    default: 'name'
  },
  namePrefix: {
    type: String,
    default: ''
  }
})

const getItemName = (item) => {
  if (item[props.nameKey]) {
    return item[props.nameKey]
  }
  // Fallback: try to extract from ID
  if (item.taskId) {
    return `${props.namePrefix}${item.taskId.split('_')[1] || item.taskId}`
  }
  if (item.jobId) {
    return `${props.namePrefix}${item.jobId.split('_')[1] || item.jobId}`
  }
  return 'Unknown'
}
</script>

<style scoped>
.queue-section {
  background: var(--bg-light);
  padding: 1rem;
}

.queue-section h3 {
  margin: 0 0 1rem 0;
  color: var(--text-primary);
  text-align: center;
}

.queue-cards {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.queue-card {
  flex: 0 0 150px;
  background: var(--bg-light);
  border: 2px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.queue-card-header {
  background: var(--primary-color);
  padding: 0.75rem;
  text-align: center;
  font-weight: 500;
  font-size: 1rem;
  color: var(--text-primary);
}

.queue-card-body {
  flex: 1;
  padding: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  background: var(--bg-darker);
}

.item-thumbnail {
  width: 90px;
  height: 90px;
  background: var(--bg-light);
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.queue-card-footer {
  background: var(--primary-color);
  padding: 0.6rem;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.no-items {
  color: var(--text-secondary);
  padding: 2rem;
  text-align: center;
  width: 100%;
}
</style>
