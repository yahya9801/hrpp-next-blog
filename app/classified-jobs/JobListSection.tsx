// app/jobs/JobListSection.tsx
import Link from "next/link";
import ShareButton from "@/components/ShareButton";
import InFeedAdUnit from "@/components/InFeedAdUnit";
import JobViewTracker from "@/components/JobViewTracker";

export const revalidate = 60;

interface JobImage {
  image_path: string;
}
interface Job {
  id: number;
  title: string;
  slug: string;
  posted_at: string;
  expiry_date: string;
  description: string;
  short_description?: string;
  image_path?: string;
  images: string[];
  locations: string[];
  roles: string[];
  experiences: string[];
}

interface JobListSectionProps {
  page?: number;
  searchParams?: Record<string, string>;
}

async function getJobs(
  page = 1,
  filters: JobListSectionProps["searchParams"] = {}
): Promise<{ data: Job[]; last_page: number }> {
  // ✅ Normalize filters to ensure it's a plain object
  let safeFilters: Record<string, string> = { page: page.toString() };

  if (filters instanceof URLSearchParams) {
    for (const [key, value] of filters.entries()) {
      if (value) safeFilters[key] = value;
    }
  } else if (filters && typeof filters === "object") {
    safeFilters = {
      ...safeFilters,
      ...Object.fromEntries(
        Object.entries(filters).filter(
          ([, value]) => typeof value === "string" && value !== ""
        )
      ),
    };
  }

  const query = new URLSearchParams(safeFilters).toString();

  const res = await fetch(
    `https://admin.hrpostingpartner.com/api/jobs?${query}`,
    {
      next: { revalidate: 60 },
    }
  );

  if (!res.ok) throw new Error("Failed to fetch jobs");

  const data = await res.json();
  return { data: data.data, last_page: data.meta?.last_page || 1 };
}

export default async function JobListSection({
  page = 1,
  searchParams = {},
}: JobListSectionProps) {
  const { data: jobs, last_page } = await getJobs(page, searchParams);

  if (!jobs || jobs.length === 0) {
    return <p className="text-center text-gray-500">No jobs found.</p>;
  }

  // Split jobs into chunks of 5
  const chunkedJobs = [];
  for (let i = 0; i < jobs.length; i += 5) {
    chunkedJobs.push(jobs.slice(i, i + 5));
  }

  const queryString = new URLSearchParams(
    Object.entries(searchParams || {}).reduce((acc, [key, value]) => {
      if (key !== "page" && typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, string>)
  ).toString();
  const pagePath = `/classified-jobs${
    queryString ? `?${queryString}&page=` : `?page=`
  }`;

  // helpers
  const DOTS = "…";

  function getPaginationRange({
    currentPage,
    totalPages,
    siblingCount = 1, // how many numbers to show on each side
    boundaryCount = 1, // how many numbers to keep at the start/end
  }: {
    currentPage: number;
    totalPages: number;
    siblingCount?: number;
    boundaryCount?: number;
  }) {
    const range = (start: number, end: number) =>
      Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const totalNumbers = boundaryCount * 2 + siblingCount * 2 + 3; // first, last, current
    if (totalPages <= totalNumbers) return range(1, totalPages);

    const leftSibling = Math.max(currentPage - siblingCount, boundaryCount + 2);
    const rightSibling = Math.min(
      currentPage + siblingCount,
      totalPages - boundaryCount - 1
    );

    const showLeftDots = leftSibling > boundaryCount + 2;
    const showRightDots = rightSibling < totalPages - boundaryCount - 1;

    const firstPages = range(1, boundaryCount);
    const lastPages = range(totalPages - boundaryCount + 1, totalPages);

    if (!showLeftDots && showRightDots) {
      const leftRange = range(1, rightSibling + (boundaryCount + 1 - 1));
      return [...leftRange, DOTS, ...lastPages];
    }

    if (showLeftDots && !showRightDots) {
      const rightRange = range(
        leftSibling - (boundaryCount + 1 - 1),
        totalPages
      );
      return [...firstPages, DOTS, ...rightRange];
    }

    return [
      ...firstPages,
      DOTS,
      ...range(leftSibling, rightSibling),
      DOTS,
      ...lastPages,
    ];
  }

  return (
    <div className="space-y-6">
      {chunkedJobs.map((chunk, idx) => (
        <div key={idx}>
      {chunk.map((job) => (
        <Link
          key={job.id}
          href={`/classified-jobs/${job.slug}`}
          className="block border border-gray-200 rounded-lg p-4 sm:p-5 shadow-sm hover:shadow-md transition bg-white hover:bg-gray-50"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            {job.images && job.images.length > 0 && (
              <img
                src={`${job.images[0]}`}
                alt={job.title}
                className="w-20 h-20 sm:w-16 sm:h-16 rounded object-cover mx-auto sm:mx-0"
              />
            )}

            <div className="text-center sm:text-left flex-1">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h2 className="text-lg sm:text-xl font-semibold text-blue-700">
                  {job.title}
                </h2>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600">
                  Views: {job.views}
                  <ShareButton title={job.slug} />
                  
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                {/* Dates on the left */}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <p>
                    <span className="font-semibold text-gray-700">Posted:</span>{" "}
                    {job.posted_at}
                  </p>
                  <p>
                    <span className="font-semibold text-gray-700">
                      Expires:
                    </span>{" "}
                    {job.expiry_date ?? "N/A"}
                  </p>
                </div>

                {/* Status Badge on the right */}
                <span
                  className={`px-2 py-1 rounded-full font-medium ml-4 ${
                    job.expiry_date && new Date(job.expiry_date) >= new Date()
                      ? "bg-green-100 text-green-700 border border-green-300"
                      : "bg-red-100 text-red-700 border border-red-300"
                  }`}
                >
                  {job.expiry_date && new Date(job.expiry_date) >= new Date()
                    ? "Active"
                    : "Expired"}
                </span>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-700 line-clamp-3 mb-3">
            {job.short_description}
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            {job.locations?.map((loc) => (
              <span
                key={loc}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full mr-2 mb-2"
              >
                📍 {loc}
              </span>
            ))}

            {job.roles?.map((role, idx) => (
              <span
                key={idx}
                className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full mr-2 mb-2"
              >
                #{role}
              </span>
            ))}

            {job.experiences?.map((experience: string, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1 rounded-full mr-2 mb-2"
              >
                🧳 {experience}
              </span>
            ))}
          </div>
        </Link>
      ))}
      <div>
        <InFeedAdUnit slotId="3398572260" />
        </div>
      </div>
      ))}


      {/* Pagination */}
      <div className="flex flex-wrap justify-center gap-2 mt-10">
        {/* Prev */}
        <Link
          href={`${pagePath}${Math.max(1, page - 1)}`}
          aria-disabled={page === 1}
          className={`px-3 py-2 rounded border text-sm transition ${
            page === 1
              ? "bg-gray-100 text-gray-400 border-gray-200 pointer-events-none"
              : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
          }`}
        >
          Prev
        </Link>

        {getPaginationRange({
          currentPage: page,
          totalPages: last_page,
          siblingCount: 1,
          boundaryCount: 1,
        }).map((item, idx) =>
          item === DOTS ? (
            <span
              key={`dots-${idx}`}
              className="px-3 py-2 text-gray-500 select-none"
            >
              {DOTS}
            </span>
          ) : (
            <Link
              key={item}
              href={`${pagePath}${item}`}
              className={`px-4 py-2 rounded border text-sm transition ${
                page === item
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
              }`}
              aria-current={page === item ? "page" : undefined}
            >
              {item}
            </Link>
          )
        )}

        {/* Next */}
        <Link
          href={`${pagePath}${Math.min(last_page, page + 1)}`}
          aria-disabled={page === last_page}
          className={`px-3 py-2 rounded border text-sm transition ${
            page === last_page
              ? "bg-gray-100 text-gray-400 border-gray-200 pointer-events-none"
              : "bg-white text-blue-600 border-blue-300 hover:bg-blue-50"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
