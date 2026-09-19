import { connectToDatabase } from "../../../../src/db/mongoose";
import { jsonError, jsonOk } from "../../../../src/http/responses";
import { BirthLocationModel } from "../../../../src/models/BirthLocation";

export const runtime = "nodejs";

const MIN_PUBLIC_REGION_BIRTHS = 3;
const MAX_PUBLIC_REGIONS = 200;

type RegionAggregate = {
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

    const [populationWithLocation, regions] = await Promise.all([
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
            label: {
              $first: "$label"
            },
            countryCode: {
              $first: "$countryCode"
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
            label: 1,
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
            label: 1,
            countryCode: 1,
            latitude: 1,
            longitude: 1,
            births: 1
          }
        }
      ])
    ]);

    return jsonOk({
      populationWithLocation,
      minimumRegionBirths: MIN_PUBLIC_REGION_BIRTHS,
      regions
    });
  } catch {
    return jsonError(503, "server_misconfigured", "Species map is unavailable.");
  }
}
