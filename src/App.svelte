<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAll, session, settings } from '$stores/app';
  import LibraryView from '$components/LibraryView.svelte';
  import EditView from '$components/EditView.svelte';
  import PerformView from '$components/PerformView.svelte';

  let ready = $state(false);

  onMount(async () => {
    await loadAll();
    ready = true;
  });

  // Keep the document direction in sync with the chrome direction setting.
  $effect(() => {
    document.documentElement.dir = $settings.chromeDir === 'ltr' ? 'ltr' : 'rtl';
  });
</script>

{#if !ready}
  <div class="boot" aria-busy="true">Loading…</div>
{:else if $session.view === 'perform'}
  <PerformView />
{:else if $session.view === 'edit'}
  <EditView />
{:else}
  <LibraryView />
{/if}

<style>
  .boot {
    display: grid;
    place-items: center;
    height: 100%;
    color: var(--ink-3);
    font-size: var(--text-sm);
  }
</style>
