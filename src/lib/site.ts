// Domínio público do site. Fonte única para sitemap, meta tags e qualquer URL
// absoluta — era o que faltava quando saímos do Lovable e o domínio antigo
// ficou espalhado por três arquivos.
//
// O robots.txt é estático (public/robots.txt) e não consegue importar daqui;
// se este valor mudar, ele precisa ser atualizado na mão também.
export const SITE_URL = "https://receitahub.vercel.app";

// Imagem de compartilhamento. Vive em public/ de propósito, e não como import
// do Vite: assets importados ganham hash no nome a cada build, e as redes
// sociais fazem cache da URL — depois de um redeploy o link cacheado apontaria
// para um arquivo que não existe mais. public/ não recebe hash.
export const OG_IMAGE_URL = `${SITE_URL}/og-image.jpg`;
