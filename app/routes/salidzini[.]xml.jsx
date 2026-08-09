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
      products(first: 100, query: "status:active") {
        nodes {
          id
          title
          handle
          vendor
          productType
          onlineStoreUrl
          featuredImage {
            url
          }
          variants(first: 1) {
            nodes {
              price
              sku
              barcode
              inventoryQuantity
              availableForSale
              selectedOptions {
                name
                value
              }
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

  const itemXml = products
    .filter((product) => {
      const variant = product.variants?.nodes?.[0];

      if (!variant) return false;
      if (!variant.availableForSale) return false;

      const text = `${product.title} ${product.productType}`.toLowerCase();

      const blockedWords = [
        "alcohol",
        "alkohols",
        "alkoholisks",
        "beer",
        "wine",
        "vodka",
        "tobacco",
        "tabaka",
        "cigarette",
        "cigaretes",
      ];

      return !blockedWords.some((word) => text.includes(word));
    })
    .map((product) => {
      const variant = product.variants.nodes[0];

      const productUrl =
        product.onlineStoreUrl ||
        `https://salidzini-feed-test-a2zidwg2.myshopify.com/products/${product.handle}`;

      const color =
        variant.selectedOptions?.find(
          (option) =>
            option.name.toLowerCase() === "color" ||
            option.name.toLowerCase() === "colour" ||
            option.name.toLowerCase() === "krāsa"
        )?.value || "";

      const brand = product.vendor || "";
      const model = variant.sku || "";
      const name = `${brand ? `${brand} ` : ""}${product.title}`
        .trim()
        .slice(0, 200);

      const stock = Math.max(0, variant.inventoryQuantity || 0);

      return `
  <item>
    <name>${escapeXml(name)}</name>
    <link>${escapeXml(productUrl)}</link>
    <price>${escapeXml(variant.price || "")}</price>

    <category_full>${escapeXml(product.productType || "")}</category_full>
    <category_link></category_link>

    <image>${escapeXml(product.featuredImage?.url || "")}</image>

    <in_stock>${stock}</in_stock>

    <brand>${escapeXml(brand)}</brand>
    <model>${escapeXml(model)}</model>
    <color>${escapeXml(color)}</color>
    <mpn>${escapeXml(variant.sku || "")}</mpn>
    <ean>${escapeXml(variant.barcode || "")}</ean>

    <delivery_latvija>2.49</delivery_latvija>
    <delivery_days_latvija>3</delivery_days_latvija>
    <delivery_days_shop></delivery_days_shop>

    <service_fee>0</service_fee>

    <used></used>
    <adult>no</adult>
  </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
${itemXml}
</root>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
};