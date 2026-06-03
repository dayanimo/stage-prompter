<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAll, session, settings } from '$stores/app';
  import LibraryView from '$components/LibraryView.svelte';
  import EditView from '$components/EditView.svelte';
  import PerformView from '$components/PerformView.svelte';
  import RemoteView from '$components/RemoteView.svelte';

  let ready = $state(false);

  // The remote-control page is a separate, DB-free route (#remote): it only
  // talks to the Stage over the internal channel, so it skips loadAll().
  let isRemote = $state(typeof location !== 'undefined' && location.hash === '#remote');

  $effect(() => {
    const syncHash = () => (isRemote = location.hash === '#remote');
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  });

  onMount(async () => {
    // The remote route is DB-free; only the main app needs the local data.
    if (location.hash === '#remote') return;
    await loadAll();
    ready = true;
  });

  // Keep the document direction in sync with the chrome direction setting.
  $effect(() => {
    document.documentElement.dir = $settings.chromeDir === 'ltr' ? 'ltr' : 'rtl';
  });
</script>

{#if isRemote}
  <RemoteView />
{:else if !ready}
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
