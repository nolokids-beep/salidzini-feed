import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export default function Index() {
  return (
    <s-page heading="Salīdzini.lv produktu feeds">
      <s-section heading="Produktu feeds">
        <s-paragraph>
          Izveido un pārvaldi sava Shopify veikala produktu XML feedu
          Salīdzini.lv sistēmai.
        </s-paragraph>

        <s-stack direction="block" gap="base">
          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="base">
              <s-heading>Salīdzini.lv XML feeds</s-heading>

              <s-paragraph>
                Feedā tiks iekļauti tava veikala produkti, cenas,
                pieejamība un cita Salīdzini.lv nepieciešamā informācija.
              </s-paragraph>

              <s-stack direction="inline" gap="base">
                <s-button href="/salidzini.xml" target="_blank">
                  Atvērt XML feedu
                </s-button>
              </s-stack>
            </s-stack>
          </s-box>

          <s-box
            padding="base"
            borderWidth="base"
            borderRadius="base"
          >
            <s-stack direction="block" gap="base">
              <s-heading>Statuss</s-heading>

              <s-paragraph>
                Shopify savienojums: aktīvs
              </s-paragraph>

              <s-paragraph>
                Salīdzini.lv feeds: konfigurēts
              </s-paragraph>
            </s-stack>
          </s-box>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Feed URL">
        <s-paragraph>
          Salīdzini.lv sistēmā būs jānorāda publiskā XML feeda adrese.
        </s-paragraph>

        <s-paragraph>
          <s-text>/salidzini.xml</s-text>
        </s-paragraph>
      </s-section>

      <s-section slot="aside" heading="Nākamie soļi">
        <s-unordered-list>
          <s-list-item>Pārbaudīt XML feeda saturu</s-list-item>
          <s-list-item>Pārbaudīt produktu cenas un pieejamību</s-list-item>
          <s-list-item>Iesniegt feed URL Salīdzini.lv</s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};