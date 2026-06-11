<script setup lang="ts">
type ConfirmDialogVariant = 'danger' | 'success' | 'info'

withDefaults(defineProps<{
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText?: string
  variant?: ConfirmDialogVariant
  loading?: boolean
}>(), {
  cancelText: 'Cancelar',
  variant: 'danger',
  loading: false,
})

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="confirmation-backdrop"
      @click.self="emit('cancel')"
    >
      <section class="confirmation-dialog" role="dialog" aria-modal="true">
        <div
          :class="[
            'confirmation-icon',
            variant === 'danger' && 'confirmation-icon-danger',
            variant === 'success' && 'confirmation-icon-success',
            variant === 'info' && 'confirmation-icon-info',
          ]"
        >
          {{ variant === 'danger' ? '!' : variant === 'success' ? '✓' : 'i' }}
        </div>

        <p class="eyebrow">Confirmación</p>

        <h2>{{ title }}</h2>

        <p class="confirmation-message">
          {{ message }}
        </p>

        <div class="confirmation-actions">
        <button
            class="confirmation-action-button secondary-button"
            type="button"
            :disabled="loading"
            @click="emit('cancel')"
        >
            {{ cancelText }}
        </button>

        <button
            :class="[
            'confirmation-action-button',
            variant === 'danger' ? 'danger-button' : 'success-button'
            ]"
            type="button"
            :disabled="loading"
            @click="emit('confirm')"
        >
            {{ loading ? 'Procesando...' : confirmText }}
        </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.confirmation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(3px);
}

.confirmation-dialog {
  width: min(100%, 520px);
  padding: 32px;
  border-radius: 28px;
  background: #ffffff;
  box-shadow: 0 24px 80px rgba(15, 23, 42, 0.28);
  text-align: center;
}

.confirmation-icon {
  display: inline-grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 16px;
  border-radius: 999px;
  font-size: 1.6rem;
  font-weight: 900;
}

.confirmation-icon-danger {
  background: #fee2e2;
  color: #991b1b;
}

.confirmation-icon-success {
  background: #dcfce7;
  color: #166534;
}

.confirmation-icon-info {
  background: #dbeafe;
  color: #1d4ed8;
}

.confirmation-dialog .eyebrow {
  margin-bottom: 8px;
}

.confirmation-dialog h2 {
  margin: 0;
  color: #111827;
  font-size: 1.8rem;
}

.confirmation-message {
  margin: 14px 0 26px;
  color: #6b7280;
  line-height: 1.6;
}

.confirmation-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  width: 100%;
  margin-top: 8px;
}

.confirmation-action-button {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-width: 0;
  min-height: 56px;
  border-radius: 16px;
  padding: 12px 18px;
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  cursor: pointer;
  user-select: none;
}

.confirmation-action-button.secondary-button {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #111827;
}

.confirmation-action-button.danger-button {
  border: 1px solid #dc2626;
  background: #dc2626;
  color: #ffffff;
}

.confirmation-action-button.danger-button:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

.confirmation-action-button.success-button {
  border: 1px solid #16a34a;
  background: #16a34a;
  color: #ffffff;
}

.confirmation-action-button.success-button:hover {
  background: #15803d;
  border-color: #15803d;
}

.confirmation-action-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 520px) {
  .confirmation-actions {
    grid-template-columns: 1fr;
  }

  .confirmation-action-button.secondary-button {
    order: 2;
  }

  .confirmation-action-button.danger-button,
  .confirmation-action-button.success-button {
    order: 1;
  }
}
</style>