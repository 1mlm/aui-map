import { Suspense } from "react";
import { buildAreas } from "@/map/areas";
import { getCampusShapes } from "@/map/getCampusShapes";
import { getMapData } from "@/map/getMapData";
import { MapExperience } from "@/map/MapExperience";

// pins/tags rarely change — cheap time-based freshness here, plus admin mutations
// call revalidatePath("/") for instant freshness right after a save
export const revalidate = 60;

const SITE_STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://auimap.ma/#website",
      url: "https://auimap.ma",
      name: "AUI Map",
      alternateName: ["AUI campus map", "Al Akhawayn University map"],
      description:
        "Interactive campus map of Al Akhawayn University in Ifrane, Morocco: every building, residence, service, restaurant and landmark.",
      inLanguage: "en",
      about: { "@id": "https://auimap.ma/#campus" },
      copyrightNotice:
        "Credit AUI Map (https://auimap.ma) when you use this information",
      license: "https://creativecommons.org/licenses/by/4.0/",
    },
    {
      "@type": "CollegeOrUniversity",
      "@id": "https://auimap.ma/#campus",
      name: "Al Akhawayn University",
      alternateName: ["AUI", "Al Akhawayn University in Ifrane"],
      url: "https://www.aui.ma",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Avenue Hassan II",
        postalCode: "53000",
        addressLocality: "Ifrane",
        addressRegion: "Fès-Meknès",
        addressCountry: "MA",
      },
      geo: { "@type": "GeoCoordinates", latitude: 33.5396, longitude: -5.1068 },
      hasMap: "https://auimap.ma",
    },
    {
      "@type": "Dataset",
      "@id": "https://auimap.ma/#dataset",
      name: "AUI Map: places on the Al Akhawayn University campus",
      description:
        "Every building, residence, service office, restaurant, sports facility, parking area and landmark on the Al Akhawayn University campus in Ifrane, Morocco, with aliases, coordinates, descriptions, contacts, opening hours and building outlines.",
      url: "https://auimap.ma",
      keywords: [
        "Al Akhawayn University",
        "AUI",
        "Ifrane",
        "campus map",
        "buildings",
        "GeoJSON",
      ],
      license: "https://creativecommons.org/licenses/by/4.0/",
      isAccessibleForFree: true,
      creator: {
        "@type": "Organization",
        name: "AUI Map",
        url: "https://auimap.ma",
      },
      citation: "AUI Map (https://auimap.ma)",
      spatialCoverage: {
        "@type": "Place",
        name: "Al Akhawayn University campus, Ifrane, Morocco",
        geo: {
          "@type": "GeoCoordinates",
          latitude: 33.5396,
          longitude: -5.1068,
        },
      },
      distribution: [
        {
          "@type": "DataDownload",
          encodingFormat: "application/json",
          contentUrl: "https://auimap.ma/data/places.json",
        },
        {
          "@type": "DataDownload",
          encodingFormat: "application/geo+json",
          contentUrl: "https://auimap.ma/data/campus.geojson",
        },
      ],
    },
  ],
}).replaceAll("<", "\\u003c");

export default async function Page() {
  const [{ items, tags }, shapes] = await Promise.all([
    getMapData(),
    getCampusShapes(),
  ]);
  const areas = buildAreas(shapes);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: json-ld has to be raw script text, "<" is escaped above
        dangerouslySetInnerHTML={{ __html: SITE_STRUCTURED_DATA }}
      />
      <Suspense>
        <MapExperience {...{ items, tags, areas }} />
      </Suspense>
      {/* the map is all client js, this gives crawlers (and screen readers) real text and a link to every place's own page */}
      <nav className="sr-only" aria-label="All places">
        <h1>Al Akhawayn University (Ifrane) campus map</h1>
        <ul>
          {items.map(({ id, title }) => (
            <li key={id}>
              <a href={`/${id}`}>{title}</a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
