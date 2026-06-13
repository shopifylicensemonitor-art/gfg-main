import { useEffect } from 'react';

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string[];
  canonicalUrl?: string;
  noindex?: boolean;
  ogType?: string;
  ogImage?: string;
  schema?: Record<string, unknown> | Record<string, unknown>[];
}

export const SEO = ({
  title,
  description,
  keywords,
  canonicalUrl,
  noindex = false,
  ogType = 'website',
  ogImage = '/logo-light.jpg',
  schema,
}: SEOProps) => {
  useEffect(() => {
    // 1. Title Update
    const defaultTitle = 'Peakconix Sender - Free Bulk Email outreach & Personalization Generator';
    document.title = title ? `${title} | Peakconix Sender` : defaultTitle;

    // Helper to get or create head tags
    const getOrCreateMeta = (nameOrProperty: string, valueAttribute: 'content' | 'href' = 'content'): HTMLMetaElement | HTMLLinkElement => {
      const isProperty = nameOrProperty.startsWith('og:') || nameOrProperty.startsWith('twitter:');
      const selector = isProperty
        ? `meta[property="${nameOrProperty}"]`
        : nameOrProperty === 'canonical'
        ? 'link[rel="canonical"]'
        : `meta[name="${nameOrProperty}"]`;

      let element = document.head.querySelector(selector);
      if (!element) {
        if (nameOrProperty === 'canonical') {
          element = document.createElement('link');
          (element as HTMLLinkElement).rel = 'canonical';
        } else {
          element = document.createElement('meta');
          if (isProperty) {
            (element as HTMLMetaElement).setAttribute('property', nameOrProperty);
          } else {
            (element as HTMLMetaElement).name = nameOrProperty;
          }
        }
        document.head.appendChild(element);
      }
      return element as HTMLMetaElement | HTMLLinkElement;
    };

    // 2. Robots Rule
    const robotsMeta = getOrCreateMeta('robots') as HTMLMetaElement;
    if (noindex) {
      robotsMeta.content = 'noindex, nofollow';
    } else {
      robotsMeta.content = 'index, follow';
    }

    // 3. Description Update
    if (description) {
      const descMeta = getOrCreateMeta('description') as HTMLMetaElement;
      descMeta.content = description;

      const ogDescMeta = getOrCreateMeta('og:description') as HTMLMetaElement;
      ogDescMeta.content = description;

      const twDescMeta = getOrCreateMeta('twitter:description') as HTMLMetaElement;
      twDescMeta.content = description;
    }

    // 4. Keywords Update
    if (keywords && keywords.length > 0) {
      const keywordsMeta = getOrCreateMeta('keywords') as HTMLMetaElement;
      keywordsMeta.content = keywords.join(', ');
    }

    // 5. Open Graph Core
    const ogTitleMeta = getOrCreateMeta('og:title') as HTMLMetaElement;
    ogTitleMeta.content = title || 'Peakconix Sender';

    const ogTypeMeta = getOrCreateMeta('og:type') as HTMLMetaElement;
    ogTypeMeta.content = ogType;

    const currentUrl = window.location.href;
    const ogUrlMeta = getOrCreateMeta('og:url') as HTMLMetaElement;
    ogUrlMeta.content = canonicalUrl || currentUrl;

    const resolvedOgImage = ogImage.startsWith('http') ? ogImage : `${window.location.origin}${ogImage}`;
    const ogImgMeta = getOrCreateMeta('og:image') as HTMLMetaElement;
    ogImgMeta.content = resolvedOgImage;

    // 6. Twitter Card Core
    const twCardMeta = getOrCreateMeta('twitter:card') as HTMLMetaElement;
    twCardMeta.content = 'summary_large_image';

    const twTitleMeta = getOrCreateMeta('twitter:title') as HTMLMetaElement;
    twTitleMeta.content = title || 'Peakconix Sender';

    const twImgMeta = getOrCreateMeta('twitter:image') as HTMLMetaElement;
    twImgMeta.content = resolvedOgImage;

    // 7. Canonical Link Update
    const canonicalLink = getOrCreateMeta('canonical', 'href') as HTMLLinkElement;
    canonicalLink.href = canonicalUrl || currentUrl;

    // 8. Dynamic Schema (JSON-LD) injection
    const SCHEMA_SCRIPT_ID = 'peakconix-seo-schema';
    let schemaScript = document.head.querySelector(`#${SCHEMA_SCRIPT_ID}`) as HTMLScriptElement;

    if (schema) {
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.id = SCHEMA_SCRIPT_ID;
        schemaScript.type = 'application/ld+json';
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schema);
    } else {
      if (schemaScript) {
        schemaScript.remove();
      }
    }

    // Cleanup logic when page unmounts (optional, but good for SPAs to restore defaults)
    return () => {
      // We don't necessarily have to strip meta tags on SPA change because the next page's
      // SEO component will overwrite them immediately, but we should make sure schema script is cleared
      // if the next page doesn't define one.
    };
  }, [title, description, keywords, canonicalUrl, noindex, ogType, ogImage, schema]);

  return null;
};
