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

  try {
    const { admin } = await unauthenticated.admin(shop);

    const response = await admin.graphql(`
      #graphql
      query GetProducts {
        products(first: 50, query: "status:active") {
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
                inventoryQuantity
                inventoryPolicy
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

    /*
     * Izlaižam tikai tās preces, kurām:
     * - Shopify seko noliktavas atlikumam;
     * - atlikums ir 0 vai mazāks;
     * - un nav atļauts pārdot pēc izpārdošanas.
     *
     * Ja inventory tracking nav ieslēgts, preci atstājam XML.
     */
    const availableProducts = products.filter((product) => {
      const variant = product.variants?.nodes?.[0];

      if (!variant) {
        return false;
      }

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

        const price = variant?.price ?? "";
        const sku = variant?.sku ?? "";

        const productUrl =
          product.onlineStoreUrl ||
          `https://${shop}/products/${product.handle}`;

        const image = product.featuredImage?.url ?? "";

        /*
         * Noliktavas daudzums.
         *
         * Ja Shopify inventory tracking ir ieslēgts,
         * izmantojam faktisko daudzumu.
         *
         * Ja tracking nav ieslēgts, 0 neliekam,
         * jo tas nepatiesi nozīmētu "nav noliktavā".
         */
        const stockQuantity = product.tracksInventory
          ? Math.max(variant?.inventoryQuantity ?? 0, 0)
          : "";

        /*
         * Nosaukums:
         * vendor + product title.
         *
         * Ja title jau sākas ar vendor, vendor neatkārtojam.
         */
        const vendor = (product.vendor ?? "").trim();
        const title = (product.title ?? "").trim();

        let productName = title;

        if (
          vendor &&
          !title.toLowerCase().startsWith(vendor.toLowerCase())
        ) {
          productName = `${vendor} ${title}`;
        }

        // Salidzini.lv pieļaujamais nosaukuma garums — 200 simboli.
        productName = productName.slice(0, 200);

        const category = product.productType ?? "";

        /*
         * Modelim izmantojam SKU, ja tas ir norādīts.
         * MPN arī izmanto SKU.
         */
        const model = sku;

        /*
         * Piegāde:
         * līdz €50 = €2.49
         * virs €50 = bezmaksas.
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
    <color></color>
    <mpn>${escapeXml(sku)}</mpn>
    <ean></ean>
    <delivery_latvija>${deliveryPrice}</delivery_latvija>
    <delivery_days_latvija>3</delivery_days_latvija>
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