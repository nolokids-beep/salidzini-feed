import { unauthenticated } from "../shopify.server";

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const loader = async () => {
  const shop = "salidzini-feed-test-a2zidwg2.myshopify.com";

  const { admin } = await unauthenticated.admin(shop);

  const response = await admin.graphql(`
    #graphql
    query GetProducts {
      products(first: 50) {
        nodes {
          id
          title
          handle
          description
          onlineStoreUrl
          featuredImage {
            url
          }
          variants(first: 1) {
            nodes {
              price
              sku
            }
          }
        }
      }
    }
  `);

  const data = await response.json();

  if (data.errors) {
    console.error("Shopify GraphQL errors:", data.errors);

    return new Response("Failed to load products", {
      status: 500,
    });
  }

  const products = data.data?.products?.nodes ?? [];

  const productXml = products
    .map((product) => {
      const variant = product.variants?.nodes?.[0];

      const productUrl =
        product.onlineStoreUrl ||
        `https://salidzini-feed-test-a2zidwg2.myshopify.com/products/${product.handle}`;

      return `
<product>
  <name>${escapeXml(product.title)}</name>
  <description>${escapeXml(product.description)}</description>
  <price>${escapeXml(variant?.price || "")}</price>
  <sku>${escapeXml(variant?.sku || "")}</sku>
  <url>${escapeXml(productUrl)}</url>
  <image>${escapeXml(product.featuredImage?.url || "")}</image>
</product>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<products>
${productXml}
</products>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};