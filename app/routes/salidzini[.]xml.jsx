import { unauthenticated } from "../shopify.server";

const SHOP_DOMAIN = "20715d-ja.myshopify.com";
const PUBLIC_DOMAIN = "https://www.nolokids.lv";

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getTranslation(translations = [], key) {
  return (
    translations.find(
      (translation) =>
        translation.key === key &&
        translation.locale === "lv" &&
        !translation.outdated
    )?.value || ""
  );
}

function getColor(selectedOptions = []) {
  const option = selectedOptions.find((item) => {
    const name = String(item.name || "").toLowerCase();

    return ["color", "colour", "krāsa", "krasa"].includes(name);
  });

  return option?.value || "";
}

export const loader = async () => {
  try {
    const { admin } = await unauthenticated.admin(SHOP_DOMAIN);

    let products = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await admin.graphql(
        `
          #graphql
          query GetProducts($cursor: String) {
            products(
              first: 100
              after: $cursor
              query: "status:active"
            ) {
              nodes {
                id
                title
                handle
                vendor
                productType
                tracksInventory

                translations(locale: "lv") {
                  key
                  value
                  locale
                  outdated
                }

                featuredImage {
                  url
                }

                variants(first: 1) {
                  nodes {
                    price
                    sku
                    barcode
                    inventoryQuantity
                    inventoryPolicy

                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }

              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        {
          variables: {
            cursor,
          },
        }
      );

      const data = await response.json();

      if (data.errors) {
        console.error("Shopify GraphQL errors:", data.errors);

        return new Response("Failed to load products", {
          status: 500,
        });
      }

      const page = data.data?.products;

      products.push(...(page?.nodes ?? []));

      hasNextPage = page?.pageInfo?.hasNextPage ?? false;
      cursor = page?.pageInfo?.endCursor ?? null;
    }

    const availableProducts = products.filter((product) => {
      const variant = product.variants?.nodes?.[0];

      if (!variant) return false;

      if (!product.tracksInventory) {
        return true;
      }

      const quantity = variant.inventoryQuantity ?? 0;

      if (quantity > 0) {
        return true;
      }

      return variant.inventoryPolicy === "CONTINUE";
    });

    const productXml = availableProducts
      .map((product) => {
        const variant = product.variants?.nodes?.[0];

        const lvTitle =
          getTranslation(product.translations, "title") ||
          product.title ||
          "";

        const vendor = (product.vendor ?? "").trim();

        let productName = lvTitle.trim();

        if (
          vendor &&
          !productName.toLowerCase().startsWith(vendor.toLowerCase())
        ) {
          productName = `${vendor} ${productName}`;
        }

        productName = productName.slice(0, 200);

        const price = variant?.price ?? "";
        const sku = variant?.sku ?? "";
        const ean = variant?.barcode ?? "";
        const color = getColor(variant?.selectedOptions ?? []);

        const productUrl =
          `${PUBLIC_DOMAIN}/products/${product.handle}`;

        const image = product.featuredImage?.url ?? "";

        const stockQuantity = product.tracksInventory
          ? Math.max(variant?.inventoryQuantity ?? 0, 0)
          : "";

        const category =
          getTranslation(product.translations, "product_type") ||
          product.productType ||
          "";

        const numericPrice = Number.parseFloat(price);

        // Bezmaksas piegāde tikai pirkumiem VIRs 50 €
        const deliveryPrice =
          Number.isFinite(numericPrice) && numericPrice > 50
            ? "0"
            : "2.49";

        return `
  <item>
    <name>${escapeXml(productName)}</name>
    <link>${escapeXml(productUrl)}</link>
    <price>${escapeXml(price)}</price>
    <category_full>${escapeXml(category)}</category_full>
    <category_link></category_link>
    <image>${escapeXml(image)}</image>
    <in_stock>${escapeXml(stockQuantity)}</in_stock>
    <brand>${escapeXml(vendor)}</brand>
    <model>${escapeXml(sku)}</model>
    <color>${escapeXml(color)}</color>
    <mpn>${escapeXml(sku)}</mpn>
    <ean>${escapeXml(ean)}</ean>
    <delivery_latvija>${deliveryPrice}</delivery_latvija>
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
${productXml}
</root>`;

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Salidzini XML error:", error);

    return new Response("Failed to generate Salidzini XML", {
      status: 500,
    });
  }
};