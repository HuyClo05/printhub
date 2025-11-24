<template>
  <div class="password-requirements">
    <p class="requirements-title">Password must:</p>
    <ul>
      <li :class="{ valid: checks.minLength }">
        <span class="check-icon">{{ checks.minLength ? '✓' : '○' }}</span>
        Be at least 8 characters long
      </li>
      <li :class="{ valid: checks.hasUpperCase }">
        <span class="check-icon">{{ checks.hasUpperCase ? '✓' : '○' }}</span>
        Contain at least one uppercase letter (A–Z)
      </li>
      <li :class="{ valid: checks.hasLowerCase }">
        <span class="check-icon">{{ checks.hasLowerCase ? '✓' : '○' }}</span>
        Contain at least one lowercase letter (a–z)
      </li>
      <li :class="{ valid: checks.hasNumber }">
        <span class="check-icon">{{ checks.hasNumber ? '✓' : '○' }}</span>
        Contain at least one digit (0–9)
      </li>
      <li :class="{ valid: checks.hasSpecialChar }">
        <span class="check-icon">{{ checks.hasSpecialChar ? '✓' : '○' }}</span>
        Contain at least one special character (e.g., ! @ # $ %)
      </li>
    </ul>
  </div>
</template>

<script setup>
defineProps({
  checks: {
    type: Object,
    required: true
  }
})
</script>

<style scoped>
.password-requirements {
  margin-top: 12px;
  padding: 12px;
  background: var(--bg-light);
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.requirements-title {
  color: var(--text-secondary);
  font-size: 13px;
  margin: 0 0 8px 0;
  font-weight: 600;
}

.password-requirements ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.password-requirements li {
  color: var(--text-secondary);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.password-requirements li.valid {
  color: var(--primary-color);
}

.check-icon {
  font-size: 16px;
  font-weight: bold;
  width: 18px;
  display: inline-block;
}

.password-requirements li.valid .check-icon {
  color: var(--primary-color);
}
</style>
