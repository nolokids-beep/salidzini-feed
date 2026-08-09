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

function getColor(selectedOptions = []) {
  const colorOption = selectedOptions.find((option) => {
    const name = String(option.name || "").toLowerCase();

    return (
      name === "color" ||
      name === "colour" ||
      name === "krāsa" ||
      name === "krasa"
    );
  });

  return colorOption?.value || "";
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
                onlineStoreUrl
                totalInventory
                tracksInventory

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

      if (!variant) {
        return false;
      }

      /*
       * Ja Shopify inventory tracking nav ieslēgts,
       * produktu atstājam feedā.
       */
      if (!product.tracksInventory) {
        return true;
      }

      /*
       * Ja ir reāls atlikums, produktu atstājam.
       */
      const quantity = variant.inventoryQuantity ?? 0;

      if (quantity > 0) {
        return true;
      }

      /*
       * Ja Shopify atļauj pārdot arī pēc izpārdošanas,
       * produktu arī atstājam.
       */
      return variant.inventoryPolicy === "CONTINUE";
    });

    const productXml = availableProducts
      .map((product) => {
        const variant = product.variants?.nodes?.[0];

        const price = variant?.price ?? "";
        const sku = variant?.sku ?? "";
        const ean = variant?.barcode ?? "";

        /*
         * Salidzini.lv saitei izmantojam publisko
         * reģistrēto veikala domēnu.
         */
        const productUrl =
          `${PUBLIC_DOMAIN}/products/${product.handle}`;

        const image = product.featuredImage?.url ?? "";

        /*
         * Ja noliktavas uzskaite nav ieslēgta,
         * atstājam in_stock tukšu.
         */
        const stockQuantity = product.tracksInventory
          ? Math.max(variant?.inventoryQuantity ?? 0, 0)
          : "";

        const vendor = (product.vendor ?? "").trim();
        const title = (product.title ?? "").trim();

        /*
         * Nosaukums: zīmols + produkta nosaukums.
         * Ja zīmols jau ir nosaukuma sākumā,
         * neatkārtojam to divreiz.
         */
        let productName = title;

        if (
          vendor &&
          !title.toLowerCase().startsWith(vendor.toLowerCase())
        ) {
          productName = `${vendor} ${title}`;
        }

        productName = productName.trim().slice(0, 200);

        const category = (product.productType ?? "").trim();
        const color = getColor(variant?.selectedOptions ?? []);

        /*
         * Pašlaik SKU izmantojam arī kā modeli/MPN,
         * ja atsevišķs ražotāja modeļa kods nav pieejams.
         */
        const model = sku;
        const mpn = sku;

        /*
         * Piegāde:
         * līdz €50 -> €2.49
         * virs €50 -> bezmaksas
         */
        const numericPrice = Number.parseFloat(price);

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
    <model>${escapeXml(model)}</model>
    <color>${escapeXml(color)}</color>
    <mpn>${escapeXml(mpn)}</mpn>
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