<template>
  <footer class="footer-bar">
    <div class="footer-content">
      <div class="footer-section footer-about">
        <h4>About PrintHub</h4>
        <p>Your premier destination for 3D models and creative collaboration.</p>
      </div>

      <div class="footer-section footer-links-section">
        <h4>Quick Links</h4>
        <ul class="footer-links">
          <li><a href="#">About Us</a></li>
          <li><a href="#">Terms of Service</a></li>
          <li><a href="#">Privacy Policy</a></li>
          <li><a href="#">Contact Us</a></li>
        </ul>
      </div>

      <div class="footer-section footer-contact">
        <h4>Contact</h4>
        <p>📧 hello@printhub.com</p>
        <p>📍 San Francisco, CA 94107</p>
        <p>📞 (555) 123-4567</p>
      </div>

      <div class="footer-section footer-socials">
        <h4>Follow Us</h4>
        <div class="social-links">
          <a href="#" class="social-icon">Twitter</a>
          <a href="#" class="social-icon">Facebook</a>
          <a href="#" class="social-icon">Instagram</a>
          <a href="#" class="social-icon">LinkedIn</a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>&copy; 2025 PrintHub. All rights reserved.</p>
    </div>
  </footer>
</template>

<script setup>
// No logic needed for now, pure layout
</script>

<style scoped>
.footer-bar {
  background-color: var(--bg-darker);
  color: var(--text-primary);
  padding: 40px 20px 20px;
  border-top: 2px solid var(--border-color);
  margin-top: auto;
  z-index: 100;
}

.footer-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 2rem;
}

.footer-section {
  display: flex;
  flex-direction: column;
}

.footer-section h4 {
  font-size: 1.1rem;
  color: var(--primary-color);
  margin: 0 0 1rem 0;
  font-weight: 600;
}

.footer-section p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0.5rem 0;
  line-height: 1.6;
}

.footer-links {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
}

.footer-links a {
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  transition: var(--transition);
}

.footer-links a:hover {
  color: var(--primary-color);
  padding-left: 5px;
}

.social-links {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.social-icon {
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.9rem;
  transition: var(--transition);
  padding: 0.5rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

.social-icon:hover {
  color: var(--primary-color);
  border-color: var(--primary-color);
}

.footer-bottom {
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.footer-bottom p {
  margin: 0;
}

@media (max-width: 768px) {
  .footer-bar {
    padding: 30px 15px 15px;
    min-height: auto;
  }

  .footer-content {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .footer-section h4 {
    font-size: 1rem;
  }

  .footer-section p {
    font-size: 0.85rem;
  }

  .social-links {
    gap: 0.5rem;
  }

  .social-icon {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}
</style>
