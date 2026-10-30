import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nProvider } from "@/i18n/I18nProvider";
import { AuthProvider } from "@/components/feature/AuthProvider";
import WhatsAppButton from "@/components/feature/WhatsAppButton";
import { ContentProvider } from "@/cms/ContentProvider";
import { AnnouncementBar, PreviewBadge } from "@/cms/SiteChrome";


function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <ContentProvider>
            <BrowserRouter basename={__BASE_PATH__}>
              <AppRoutes />
              <WhatsAppButton />
              <AnnouncementBar />
              <PreviewBadge />
            </BrowserRouter>
        </ContentProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
