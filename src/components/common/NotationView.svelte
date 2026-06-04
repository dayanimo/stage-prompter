<script lang="ts">
  /** Read-only staff render for performance and the editor preview. */
  import type { NotationContent } from '$lib/model';
  import Staff from '$components/common/Staff.svelte';

  interface Props {
    notation: NotationContent;
    color?: string;
    size?: number; // staff line gap in px
    beatsPerBar?: number;
  }
  let { notation, color = 'currentColor', size = 16, beatsPerBar = 0 }: Props = $props();
</script>

<div class="nv" dir="ltr">
  <Staff notes={notation.notes} clef={notation.clef} {color} {size} {beatsPerBar} />
</div>

<style>
  .nv {
    overflow-x: auto;
    max-width: 100%;
  }
</style>
