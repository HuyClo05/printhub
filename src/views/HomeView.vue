<template>
  <div class="home">
    <PrinterCard
      printerName="Ender 3"
      printerSnapshot="src\assets\images\Ender-3Size.jpg"
      currentPrintJob="benchy.gcode"
      
    />
  </div>
</template>

<script setup>
import PrinterCard from '@/components/PrinterCard.vue';
</script>

<style scoped>
.home {
  padding: 20px;
}
</style>
