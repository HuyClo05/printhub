<template>
  <div class="signup-page">
    <SignupForm />
  </div>
</template>

<script setup>
import SignupForm from '@/components/signUpForm.vue'
</script>

<style scoped>
.signup-page {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--bg-dark);
  padding: 20px;
}
</style>
