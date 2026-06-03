<script lang="ts">
  /** Read-only ASCII tablature block, used in performance and the editor preview. */
  import type { TabContent } from '$lib/model';
  import { tabToAscii } from '$lib/tab';

  interface Props {
    tab: TabContent;
    color?: string;
    size?: number; // px
  }
  let { tab, color = 'currentColor', size = 22 }: Props = $props();
  const lines = $derived(tabToAscii(tab));
</script>

<pre class="tabview" dir="ltr" style="color:{color}; font-size:{size}px">{lines.join('\n')}</pre>

<style>
  .tabview {
    font-family: var(--font-mono);
    line-height: 1.4;
    margin: 0;
    overflow-x: auto;
    white-space: pre;
    letter-spacing: 0.02em;
    font-weight: 600;
    scrollbar-width: thin;
  }
</style>
