<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- CMS pages read from `src/lib/demo-data.ts` (clearly labelled demo data); swap these exports for Lovable Cloud queries when the backend is connected — keeps one integration boundary.
- App chrome (sidebar + top bar) lives in `__root.tsx`; navigation structure is defined once in `src/components/cms/nav.ts`.
