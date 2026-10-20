<script lang="ts">
import { defineComponent, h, type PropType } from "vue";

import type { ReaderAsset, ReaderDocumentV1 } from "@/features/reader/types";
import { publicObjectUrl } from "@/features/files/publicObjectUrl";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

import { renderAstDocument, type ResolvedAsset } from "./astRenderer";

/**
 * Functional body renderer: AST → VNodes (see `astRenderer.ts`). Split out so
 * LongFormReader's template stays declarative while the recursive rendering
 * lives with the renderer it wraps.
 *
 * Asset URLs are built ONLY from `content_assets.storage_path` against the
 * public-media bucket (D-36): an `assetId` with no matching asset renders
 * nothing — never a placeholder, never a remote URL.
 */
export default defineComponent({
  name: "AstBody",
  props: {
    document: {
      type: Object as PropType<ReaderDocumentV1>,
      required: true
    },
    assets: {
      type: Array as PropType<readonly ReaderAsset[] | undefined>,
      default: () => []
    },
    supabase: {
      type: Object as PropType<SupabaseClient<Database> | null>,
      default: null
    },
    newTabLabel: {
      type: String,
      default: undefined
    },
    labelLang: {
      type: String,
      default: undefined
    }
  },
  setup(props) {
    return () =>
      h(
        "div",
        { class: "ast-body" },
        renderAstDocument(props.document, {
          assetUrl: (assetId): ResolvedAsset | null => {
            const asset = props.assets.find(
              candidate => candidate.id === assetId
            );
            if (!asset) return null;
            const url = publicObjectUrl(
              props.supabase,
              "public-media",
              asset.storagePath
            );
            return url
              ? { url, width: asset.width, height: asset.height }
              : null;
          },
          newTabLabel: props.newTabLabel,
          labelLang: props.labelLang
        })
      );
  }
});
</script>
