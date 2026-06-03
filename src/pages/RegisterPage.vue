<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppLogo from '../components/AppLogo.vue'
</script>

<template>
  <main class="auth-split">
    <section class="auth-info">
      <div class="auth-info-content">
        <h2>Elige cómo quieres registrarte</h2>
        <p>
          Dentia ajusta el registro según tu rol para pedir únicamente los datos
          necesarios.
        </p>

        <ul>
          <li>Pacientes: acceso a citas, historial y archivos clínicos</li>
          <li>Doctores: perfil profesional, agenda y recetas</li>
          <li>Correo verificado antes de iniciar sesión</li>
        </ul>
      </div>
    </section>

    <section class="auth-form-area">
      <div class="auth-card role-card">
        <div class="auth-brand">
          <AppLogo size="lg" />
          <h1>Crear cuenta</h1>
          <p>Selecciona el tipo de cuenta</p>
        </div>

        <div class="role-choice-grid">
          <RouterLink class="role-choice-card" to="/register/patient">
            <span class="role-choice-icon">P</span>
            <strong>Paciente</strong>
            <small>Agenda citas y consulta tu historial clínico.</small>
          </RouterLink>

          <RouterLink class="role-choice-card" to="/register/doctor">
            <span class="role-choice-icon">D</span>
            <strong>Doctor</strong>
            <small>Completa tu perfil profesional y gestiona tu agenda.</small>
          </RouterLink>
        </div>

        <p class="auth-link">
          ¿Ya tienes cuenta?
          <RouterLink to="/login">Iniciar sesión</RouterLink>
        </p>
      </div>
    </section>
  </main>
</template>
