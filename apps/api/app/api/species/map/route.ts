import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { BirthLocationModel } from "../../../../src/models/BirthLocation";

export const runtime = "nodejs";

const MIN_PUBLIC_REGION_BIRTHS = 3;
const MAX_PUBLIC_REGIONS = 200;
const LOCATION_LABEL_MAX_LENGTH = 80;

type RegionAggregate = {
  key: string;
  fallbackLabel: string;
  cityLabel: string | null;
  regionLabel: string | null;
  countryCode: string | null;
  countryName: string | null;
  latitude: number;
  longitude: number;
  births: number;
};

type SpeciesMapRegion = {
  key: string;
  label: string;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  births: number;
};

export async function GET() {
  try {
    await connectToDatabase();

    const [populationWithLocation, regionAggregates] = await Promise.all([
      BirthLocationModel.countDocuments(),
      BirthLocationModel.aggregate<RegionAggregate>([
        {
          $sort: {
            createdAt: 1
          }
        },
        {
          $group: {
            _id: "$locationKey",
            key: {
              $first: "$locationKey"
            },
            fallbackLabel: {
              $first: "$label"
            },
            cityLabel: {
              $first: "$cityLabel"
            },
            regionLabel: {
              $first: "$regionLabel"
            },
            countryCode: {
              $first: "$countryCode"
            },
            countryName: {
              $first: "$countryName"
            },
            latitude: {
              $first: "$latitude"
            },
            longitude: {
              $first: "$longitude"
            },
            births: {
              $sum: 1
            }
          }
        },
        {
          $match: {
            births: {
              $gte: MIN_PUBLIC_REGION_BIRTHS
            }
          }
        },
        {
          $sort: {
            births: -1,
            key: 1
          }
        },
        {
          $limit: MAX_PUBLIC_REGIONS
        },
        {
          $project: {
            _id: 0,
            key: 1,
            fallbackLabel: 1,
            cityLabel: 1,
            regionLabel: 1,
            countryCode: 1,
            countryName: 1,
            latitude: 1,
            longitude: 1,
            births: 1
          }
        }
      ])
    ]);
    const regions = regionAggregates
      .map(toSpeciesMapRegion)
      .sort((left, right) => (
        right.births - left.births ||
        left.label.localeCompare(right.label) ||
        left.key.localeCompare(right.key)
      ));

    return jsonOk({
      populationWithLocation,
      minimumRegionBirths: MIN_PUBLIC_REGION_BIRTHS,
      regions
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Species map is unavailable.");
  }
}

function toSpeciesMapRegion(region: RegionAggregate): SpeciesMapRegion {
  return {
    key: region.key,
    label: getLocationDisplayLabel(region),
    countryCode: region.countryCode,
    latitude: region.latitude,
    longitude: region.longitude,
    births: region.births
  };
}

function getLocationDisplayLabel(region: RegionAggregate) {
  const locality = region.cityLabel ?? region.regionLabel;
  const country = region.countryName ?? region.countryCode;

  if (locality && country && !sameLocationLabel(locality, country)) {
    const displayLabel = `${locality}, ${country}`;

    if (displayLabel.length <= LOCATION_LABEL_MAX_LENGTH) {
      return displayLabel;
    }
  }

  return locality ?? country ?? region.fallbackLabel ?? "Unlabeled region";
}

function sameLocationLabel(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}
