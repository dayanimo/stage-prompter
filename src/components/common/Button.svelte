<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  interface Props extends HTMLButtonAttributes {
    variant?: 'filled' | 'subtle' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    children: Snippet;
  }

  let {
    variant = 'subtle',
    size = 'md',
    children,
    type = 'button',
    ...rest
  }: Props = $props();
</script>

<button class="btn {variant} {size}" {type} {...rest}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sp-3);
    border: 1px solid transparent;
    border-radius: var(--r-md);
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--dur-fast) var(--ease-out),
      border-color var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .sm {
    height: 30px;
    padding: 0 var(--sp-4);
    font-size: var(--text-sm);
  }
  .md {
    height: 36px;
    padding: 0 var(--sp-5);
    font-size: var(--text-base);
  }
  .lg {
    height: 44px;
    padding: 0 var(--sp-6);
    font-size: var(--text-md);
  }
  .filled {
    background: var(--accent);
    color: var(--accent-ink);
    font-weight: 600;
  }
  .filled:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  .filled:active:not(:disabled) {
    background: var(--accent-press);
  }
  .subtle {
    background: var(--surface-2);
    color: var(--ink);
    border-color: var(--border);
  }
  .subtle:hover:not(:disabled) {
    background: var(--surface-3);
    border-color: var(--border-2);
  }
  .ghost {
    background: transparent;
    color: var(--ink-2);
  }
  .ghost:hover:not(:disabled) {
    background: var(--surface-2);
    color: var(--ink);
  }
  .danger {
    background: transparent;
    color: var(--danger);
    border-color: color-mix(in oklch, var(--danger) 40%, transparent);
  }
  .danger:hover:not(:disabled) {
    background: color-mix(in oklch, var(--danger) 16%, transparent);
  }
</style>
