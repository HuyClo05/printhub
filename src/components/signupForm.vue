<template>
  <div class="signup-container">
    <h2>Sign Up</h2>
    <form @submit.prevent="handleSignup">
      <div>
        <input
          v-model="email"
          type="email"
          placeholder="Email"
          required
        />
      </div>
      <div>
        <input
          v-model="password"
          type="password"
          placeholder="Password"
          required
        />
      </div>
      <ClearButton
        caption="Sign Up"
        size="100%"
        @click="handleSignup"
      />
      <p v-if="error" class="error">{{ error }}</p>
    </form>
    <p>Already have an account? <router-link to="/login">Login</router-link></p>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../firebase/authentication'
import ClearButton from './ClearButton.vue'

const { signup, error } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')

const handleSignup = async () => {
  try {
    await signup(email.value, password.value)
    router.push('/')
  } catch (err) {
    console.error('Signup failed:', err)
  }
}
</script>

<style scoped>
.signup-container {
  background: var(--bg-darker);
  border: 2px solid var(--border-color);
  width: 20%;
  padding: 40px;
}

.signup-container h2 {
  color: var(--text-primary);
  font-size: 28px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 30px;
}

form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

form > div {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

input {
  background-color: var(--bg-light);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 15px;
  transition: var(--transition);
}

input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

input:focus {
  outline: none;
  border-color: var(--primary-color);
}

.clear-button {
  width: 100%;
  height: auto;
  padding: 14px;
  background: var(--primary-color);
  color: var(--text-primary);
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  justify-content: center;
}

.clear-button:hover {
  background: var(--primary-color);
  filter: brightness(1.1);
  transform: translateY(-2px);
}

.clear-button:active {
  transform: translateY(0);
}

.error {
  padding: 12px 16px;
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid rgba(220, 53, 69, 0.3);
  border-radius: 8px;
  color: #dc3545;
  font-size: 14px;
  margin: 0;
}

.signup-container > p {
  color: var(--text-secondary);
  font-size: 14px;
  text-align: center;
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color);
}

.signup-container a {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
  transition: var(--transition);
}

.signup-container a:hover {
  filter: brightness(1.2);
}
</style>
