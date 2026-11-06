import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { buildAreas } from "@/map/areas";
import { getCampusShapes } from "@/map/getCampusShapes";
import { getMapData } from "@/map/getMapData";
import { amenityById } from "@/map/amenities";
import { placeNames } from "@/map/aliases";
import { MapExperience } from "@/map/MapExperience";
import type { MapItem } from "@/map/types";

// same cadence as the home page, plus revalidatePath("/[pinId]", "page") in the admin actions
export const revalidate = 60;

// generateMetadata and the page both need the data, cache() makes it one query per request
const getMapDataOncePerRequest = cache(getMapData);

type PageProps = { params: Promise<{ pinId: string }> };

export async function generateStaticParams() {
  const { items } = await getMapDataOncePerRequest();
  return items.map(({ id }) => ({ pinId: id }));
}

async function getPinPageData({ params }: PageProps) {
  const { pinId } = await params;
  const { items, tags } = await getMapDataOncePerRequest();
  const pin = items.find((item) => item.id === pinId);
  if (!pin) notFound();
  const areas = buildAreas(await getCampusShapes());
  return { pin, items, tags, areas };
}

// what each category is, in plain words. Only used when a pin has no hand-written description,
// so every pin page still gets a real sentence for the meta description / search snippet
const TAG_NOUNS: Record<string, string> = {
  building: "general building",
  unknownHousing: "student housing building",
  auditorium: "auditorium",
  food: "place to eat",
  sports: "sports facility",
  parking: "parking area",
  service: "campus service",
  other: "point of interest",
  restroom: "restroom",
  printer: "printing point",
};

const CAMPUS_NAME = "Al Akhawayn University (AUI)";

// "B8B is a student housing building at ..." comes first, then whatever was written about it, then
// the hard facts. Search results show roughly the first 155 characters, so the type goes up front
const namesOf = placeNames;

function getPinDescription(pin: MapItem) {
  const noun = TAG_NOUNS[pin.tag.id] ?? "place";
  const article = /^[aeiou]/i.test(noun) ? "an" : "a";
  const alias = namesOf(pin).find(
    (name) => name.toLowerCase() !== pin.title.toLowerCase(),
  );
  const intro = `${pin.title}${alias ? ` (${alias})` : ""} is ${article} ${noun} at ${CAMPUS_NAME} in Ifrane, Morocco.`;
  // admin descriptions are multi-line, a meta description is one line, and @mentions are plain names
  const written = pin.description
    ?.replace(/@([a-z0-9-]+)/gi, (_, id: string) => id)
    .replace(/\s+/g, " ")
    .trim();
  const has = pin.amenities.flatMap((id) => amenityById(id)?.label ?? []);
  const facts = [
    pin.hours && `Opening hours: ${pin.hours}.`,
    has.length > 0 && `Has: ${has.join(", ")}.`,
    pin.phone && `Phone: ${pin.phone}.`,
    pin.email && `Email: ${pin.email}.`,
  ];
  return [intro, written, ...facts, "Exact location on the AUI campus map."]
    .filter(Boolean)
    .join(" ");
}

function getPinThumbnailUrl(pin: MapItem) {
  const thumbnail = pin.attachments.find(
    ({ mimeType }) => !mimeType || mimeType.startsWith("image/"),
  );
  return thumbnail?.url;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { pin } = await getPinPageData(props);
  const description = getPinDescription(pin);
  const thumbnailUrl = getPinThumbnailUrl(pin);
  const title = `${pin.title} · ${pin.tag.label} at AUI Ifrane`;
  // the generated card (title, type, campus) is always there, a real photo goes first when there is one
  const cardUrl = `/${pin.id}/opengraph-image`;
  const images = [
    ...(thumbnailUrl ? [{ url: thumbnailUrl, alt: pin.title }] : []),
    {
      url: cardUrl,
      width: 1200,
      height: 630,
      alt: `${pin.title} at Al Akhawayn University`,
    },
  ];

  return {
    title,
    description,
    keywords: [
      pin.title,
      ...namesOf(pin),
      `${pin.title} AUI`,
      `${pin.title} Al Akhawayn`,
      `${pin.tag.label} AUI`,
      "AUI campus map",
      "Ifrane",
    ],
    alternates: { canonical: `/${pin.id}` },
    openGraph: {
      title,
      description,
      url: `/${pin.id}`,
      siteName: "AUI Map",
      locale: "en_US",
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map(({ url }) => url),
    },
    // old but still read by maps and location aware crawlers
    other: {
      "geo.region": "MA-05",
      "geo.placename": "Ifrane",
      "geo.position": `${pin.latitude};${pin.longitude}`,
      ICBM: `${pin.latitude}, ${pin.longitude}`,
      "place:location:latitude": String(pin.latitude),
      "place:location:longitude": String(pin.longitude),
      "og:latitude": String(pin.latitude),
      "og:longitude": String(pin.longitude),
      "og:locality": "Ifrane",
      "og:country-name": "Morocco",
      ...(pin.phone && { "og:phone_number": pin.phone }),
      ...(pin.email && { "og:email": pin.email }),
      "og:street-address": "Avenue Hassan II",
      "og:postal-code": "53000",
      "dcterms.rights": "CC BY 4.0, credit AUI Map (https://auimap.ma)",
    },
  };
}

// schema.org has a more exact type for some places than plain Place
const SCHEMA_TYPE_BY_TAG: Record<string, string> = {
  food: "FoodEstablishment",
  sports: "SportsActivityLocation",
  parking: "ParkingFacility",
  unknownHousing: "ApartmentComplex",
  auditorium: "CivicStructure",
};
const SCHEMA_TYPE_BY_PIN: Record<string, string> = {
  m6l: "Library",
  "health-center": "MedicalClinic",
  "post-office": "PostOffice",
  mosque: "Mosque",
  bookstore: "BookStore",
  shop: "Store",
  atms: "AutomatedTeller",
};

const POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: "Avenue Hassan II",
  postalCode: "53000",
  addressLocality: "Ifrane",
  addressRegion: "Fès-Meknès",
  addressCountry: "MA",
};

function getPinStructuredData(pin: MapItem) {
  const pageUrl = `https://auimap.ma/${pin.id}`;
  const description = getPinDescription(pin);
  const images = pin.attachments
    .filter(({ mimeType }) => !mimeType || mimeType.startsWith("image/"))
    .map(({ url, caption, latitude, longitude, heading }) => ({
      "@type": "ImageObject",
      url,
      caption: caption ?? pin.title,
      ...(latitude !== null && longitude !== null
        ? {
            contentLocation: {
              "@type": "Place",
              geo: {
                "@type": "GeoCoordinates",
                latitude,
                longitude,
              },
            },
          }
        : {}),
      ...(heading !== null
        ? {
            description: `${caption ?? pin.title}, photographed facing ${Math.round(heading)} degrees from north`,
          }
        : {}),
      creditText: "AUI Map",
      creator: {
        "@type": "Organization",
        name: "AUI Map",
        url: "https://auimap.ma",
      },
      license: "https://creativecommons.org/licenses/by/4.0/",
      acquireLicensePage: pageUrl,
    }));
  const schemaType =
    SCHEMA_TYPE_BY_PIN[pin.id] ?? SCHEMA_TYPE_BY_TAG[pin.tag.id] ?? "Place";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": schemaType === "Place" ? "Place" : ["Place", schemaType],
        "@id": `${pageUrl}#place`,
        name: pin.title,
        alternateName: namesOf(pin),
        description,
        url: pageUrl,
        identifier: pin.id,
        keywords: [pin.tag.label, ...namesOf(pin)].join(", "),
        geo: {
          "@type": "GeoCoordinates",
          latitude: pin.latitude,
          longitude: pin.longitude,
        },
        address: POSTAL_ADDRESS,
        hasMap:
          pin.mapsUrl ??
          `https://www.google.com/maps?q=${pin.latitude},${pin.longitude}`,
        image: images.length ? images : undefined,
        telephone: pin.phone ?? undefined,
        email: pin.email ?? undefined,
        // hours are free text ("8:30 to 17:00..."), kept as written
        openingHours: pin.hours ?? undefined,
        sameAs: pin.links.map(({ url }) => url),
        amenityFeature: pin.amenities.flatMap((id) => {
          const amenity = amenityById(id);
          return amenity
            ? [
                {
                  "@type": "LocationFeatureSpecification",
                  name: amenity.label,
                  value: true,
                },
              ]
            : [];
        }),
        isAccessibleForFree: true,
        publicAccess: true,
        containedInPlace: {
          "@type": "CollegeOrUniversity",
          name: "Al Akhawayn University",
          alternateName: ["AUI", "Al Akhawayn University in Ifrane"],
          url: "https://www.aui.ma",
          address: POSTAL_ADDRESS,
        },
        license: "https://creativecommons.org/licenses/by/4.0/",
        creditText: "AUI Map (https://auimap.ma)",
        copyrightNotice:
          "Credit AUI Map (https://auimap.ma) when using this information",
      },
      {
        "@type": "WebPage",
        "@id": pageUrl,
        url: pageUrl,
        name: `${pin.title} · ${pin.tag.label} at AUI Ifrane`,
        description,
        inLanguage: "en",
        dateModified: pin.updatedAt.toISOString(),
        mainEntity: { "@id": `${pageUrl}#place` },
        about: { "@id": `${pageUrl}#place` },
        isPartOf: { "@id": "https://auimap.ma/#website" },
        primaryImageOfPage: images[0] ?? undefined,
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "AUI campus map",
              item: "https://auimap.ma",
            },
            { "@type": "ListItem", position: 2, name: pin.tag.label },
            {
              "@type": "ListItem",
              position: 3,
              name: pin.title,
              item: pageUrl,
            },
          ],
        },
      },
    ],
  };
}

export default async function Page(props: PageProps) {
  const { pin, items, tags, areas } = await getPinPageData(props);
  const structuredData = JSON.stringify(getPinStructuredData(pin)).replaceAll(
    "<",
    "\\u003c",
  );

  return (
    <>
      <Suspense>
        <MapExperience initialSelectedId={pin.id} {...{ items, tags, areas }} />
      </Suspense>
      {/* the map itself is all client js, this is what a crawler (or a screen reader) actually reads */}
      <article className="sr-only">
        <h1>{pin.title}</h1>
        <p>{getPinDescription(pin)}</p>
        {pin.hours && <p>Opening hours: {pin.hours}</p>}
        {pin.phone && <p>Phone: {pin.phone}</p>}
        {pin.amenities.length > 0 && (
          <p>
            Has:{" "}
            {pin.amenities
              .flatMap((id) => amenityById(id)?.label ?? [])
              .join(", ")}
          </p>
        )}
        {pin.email && <p>Email: {pin.email}</p>}
        {namesOf(pin).length > 0 && (
          <p>Also called: {namesOf(pin).join(", ")}</p>
        )}
        <p>
          Coordinates: {pin.latitude}, {pin.longitude}. Al Akhawayn University,
          Avenue Hassan II, Ifrane 53000, Morocco.
        </p>
        <p>
          Credit AUI Map (https://auimap.ma) when you use this information. All
          places: <a href="/data/places.json">places.json</a>
        </p>
        <a href="/">Back to the AUI campus map</a>
      </article>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: json-ld has to be raw script text, "<" is escaped above
        dangerouslySetInnerHTML={{ __html: structuredData }}
      />
    </>
  );
}
