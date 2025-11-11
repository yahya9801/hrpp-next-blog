import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Fragment } from "react";

import { ArrowLeft } from "lucide-react";
import BlogShareButton from "@/components/BlogShareButton";
import InArticleAd from "@/components/InArticleAd";

const API_BASE_URL = "https://admin.hrpostingpartner.com/api";

export const revalidate = 300;

interface BlogDetail {
  id: number;
  title: string;
  slug: string;
  content_html: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  published_at_readable?: string | null;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
  author?: {
    id: number;
    name: string;
  } | null;
  seo?: {
    title?: string | null;
    description?: string | null;
    canonical_url?: string | null;
    image?: string | null;
    published_at?: string | null;
  } | null;
}

interface LatestBlogSummary {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  published_at_readable?: string | null;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
}

interface SimilarCategoryBlog {
  id: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  published_at_readable?: string | null;
  is_featured?: boolean;
  category?: {
    id: number;
    name: string;
    slug: string;
  } | null;
}

interface CategorySummary {
  id: number;
  name: string;
  slug: string;
}

interface LatestJob {
  id: number;
  title: string;
  slug: string;
  short_description?: string | null;
  posted_at?: string | null;
  locations?: string[] | null;
}

const getBlog = cache(async (slug: string): Promise<BlogDetail | null> => {
  const res = await fetch(`${API_BASE_URL}/blogs/${slug}`, {
    next: { revalidate },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return null;
    }
    console.error(`Failed to fetch blog ${slug}`, res.statusText);
    return null;
  }

  const data = await res.json();
  return data?.data ?? null;
});

const getLatestBlogs = cache(
  async (excludeSlug: string): Promise<LatestBlogSummary[]> => {
    const url = new URL(`${API_BASE_URL}/blogs/latest`);
    if (excludeSlug) {
      url.searchParams.set("exclude", excludeSlug);
    }

    const res = await fetch(url.toString(), {
      next: { revalidate },
    });

    if (!res.ok) {
      console.error("Failed to fetch latest blogs", res.statusText);
      return [];
    }

    const data = await res.json();
    const blogs = Array.isArray(data?.data) ? data.data : [];
    return blogs.slice(0, 5);
  },
);

const getSimilarCategoryBlogs = cache(
  async (
    categorySlug: string,
    excludeSlug: string,
  ): Promise<SimilarCategoryBlog[]> => {
    if (!categorySlug) {
      return [];
    }

    const url = new URL(
      `${API_BASE_URL}/blogs/categories/${encodeURIComponent(categorySlug)}/latest`,
    );

    if (excludeSlug) {
      url.searchParams.set("exclude", excludeSlug);
    }

    const res = await fetch(url.toString(), {
      next: { revalidate },
    });

    if (!res.ok) {
      console.error(
        `Failed to fetch similar category blogs for ${categorySlug}`,
        res.statusText,
      );
      return [];
    }

    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    return items.slice(0, 5);
  },
);

const getOtherCategories = cache(
  async (categorySlug: string | null): Promise<CategorySummary[]> => {
    const slug = categorySlug?.trim();

    const url = new URL(
      `${API_BASE_URL}/blogs/categories-excluding/${encodeURIComponent(slug || "all")}`,
    );

    const res = await fetch(url.toString(), {
      next: { revalidate },
    });

    if (!res.ok) {
      console.error(
        `Failed to fetch categories excluding ${slug ?? "all"}`,
        res.statusText,
      );
      return [];
    }

    const data = await res.json();

    return Array.isArray(data?.data)
      ? (data.data as CategorySummary[]).slice(0, 10)
      : [];
  },
);

const getLatestJobs = cache(async (): Promise<LatestJob[]> => {
  const res = await fetch(`${API_BASE_URL}/jobs/latest`, {
    next: { revalidate },
  });

  if (!res.ok) {
    console.error("Failed to fetch latest jobs", res.statusText);
    return [];
  }

  const data = await res.json();
  return Array.isArray(data?.data) ? (data.data as LatestJob[]).slice(0, 5) : [];
});

const AD_MARKER = "<!--IN_ARTICLE_AD_MARKER-->";

type InsertAdMarkersResult = {
  html: string;
  insertedCount: number;
};

function insertAdMarkers(
  html: string | null | undefined,
  marker: string,
): InsertAdMarkersResult {
  if (!html) {
    return { html: "", insertedCount: 0 };
  }

  const paragraphMatches = Array.from(html.matchAll(/<\/p>/gi));
  const paragraphTargets = getAdParagraphTargets(html, paragraphMatches);
  const uniqueTargets = Array.from(new Set(paragraphTargets));

  let updatedHtml = html;
  let insertedCount = 0;

  uniqueTargets
    .sort((a, b) => b - a)
    .forEach((paragraphIndex) => {
      const result = insertMarkerAfterParagraph(updatedHtml, marker, paragraphIndex);
      if (result.inserted) {
        updatedHtml = result.html;
        insertedCount += 1;
      }
    });

  if (insertedCount === 0 && html.trim().length > 0) {
    updatedHtml = `${html}${marker}`;
    insertedCount = 1;
  }

  return { html: updatedHtml, insertedCount };
}

function getAdParagraphTargets(
  html: string,
  paragraphMatches: RegExpMatchArray[],
): number[] {
  const paragraphCount = paragraphMatches.length;

  if (paragraphCount === 0) {
    return [];
  }

  if (paragraphCount <= 4) {
    return [paragraphCount];
  }

  const targets =
    paragraphCount <= 7
      ? [3, paragraphCount]
      : [3, Math.min(6, paragraphCount - 2), paragraphCount - 1];

  let normalizedTargets = targets
    .map((target) => Math.max(2, Math.min(target, paragraphCount)))
    .filter(
      (target, index, self) =>
        target >= 2 && target <= paragraphCount && self.indexOf(target) === index,
    );

  const firstHeadingMatch = /<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/i.exec(html);
  if (firstHeadingMatch) {
    const headingEnd = firstHeadingMatch.index + firstHeadingMatch[0].length;
    const firstParagraphAfterHeadingIdx = paragraphMatches.findIndex(
      (match) => (match.index ?? 0) > headingEnd,
    );

    if (firstParagraphAfterHeadingIdx !== -1) {
      const minimumTarget = Math.min(paragraphCount, firstParagraphAfterHeadingIdx + 2);
      normalizedTargets = normalizedTargets.map((target, index) => {
        if (index === 0 && target <= minimumTarget - 1) {
          return Math.min(paragraphCount, Math.max(minimumTarget, target + 1));
        }
        return target;
      });
    }
  }

  const minSpacing = 2;
  const spacedTargets: number[] = [];

  for (const target of normalizedTargets.sort((a, b) => a - b)) {
    if (spacedTargets.length === 0) {
      spacedTargets.push(target);
      continue;
    }

    const lastTarget = spacedTargets[spacedTargets.length - 1];
    let adjustedTarget = target;

    if (adjustedTarget - lastTarget < minSpacing) {
      const candidate = lastTarget + minSpacing;

      if (candidate > paragraphCount) {
        continue;
      }

      adjustedTarget = candidate;
    }

    if (!spacedTargets.includes(adjustedTarget)) {
      spacedTargets.push(adjustedTarget);
    }
  }

  if (spacedTargets.length === 0) {
    spacedTargets.push(paragraphCount);
  }

  return spacedTargets;
}

function insertMarkerAfterParagraph(
  html: string,
  marker: string,
  paragraphIndex: number,
): { html: string; inserted: boolean } {
  const closingParagraphTag = "</p>";
  let searchIndex = 0;
  let paragraphCounter = 0;

  while (searchIndex < html.length) {
    const closingIndex = html.indexOf(closingParagraphTag, searchIndex);

    if (closingIndex === -1) {
      break;
    }

    paragraphCounter += 1;
    const insertPosition = closingIndex + closingParagraphTag.length;

    if (paragraphCounter === paragraphIndex) {
      return {
        html: `${html.slice(0, insertPosition)}${marker}${html.slice(insertPosition)}`,
        inserted: true,
      };
    }

    searchIndex = insertPosition;
  }

  return { html, inserted: false };
}

type PreparedContentSections = {
  sections: string[];
  adInsertionIndices: number[];
};

function prepareContentSections(
  html: string | null | undefined,
  marker: string,
): PreparedContentSections {
  if (!html) {
    return { sections: [], adInsertionIndices: [] };
  }

  const { html: htmlWithMarkers } = insertAdMarkers(html, marker);
  const rawSections = htmlWithMarkers.split(marker);

  const sections: string[] = [];
  const adInsertionIndices = new Set<number>();
  let lastEffectiveIndex: number | null = null;

  rawSections.forEach((rawSection, rawIndex) => {
    const trimmedSection = rawSection.trim();

    if (trimmedSection.length > 0) {
      sections.push(rawSection);
      lastEffectiveIndex = sections.length - 1;
    }

    if (rawIndex < rawSections.length - 1 && lastEffectiveIndex !== null) {
      adInsertionIndices.add(lastEffectiveIndex);
    }
  });

  if (sections.length === 0 && html.trim().length > 0) {
    sections.push(html);
  }

  return {
    sections,
    adInsertionIndices: Array.from(adInsertionIndices).sort((a, b) => a - b),
  };
}

type BlogPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: BlogPageProps): Promise<Metadata> {
  const { slug } = await params;
  const blog = await getBlog(slug);

  if (!blog) {
    return {
      title: "Blog Not Found | HR Posting Partner",
      description: "The blog you are looking for is not available.",
    };
  }

  const title = blog.seo?.title || blog.title;
  const description = blog.seo?.description || blog.excerpt || "";
  const canonical =
    blog.seo?.canonical_url ||
    `https://www.hrpostingpartner.com/blogs/${blog.slug}`;
  const ogImage = blog.seo?.image || blog.image_url || undefined;

  return {
    title,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: canonical,
      images: ogImage
        ? [
            {
              url: ogImage,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

function formatPublishedDate(
  blog: Pick<BlogDetail, "published_at" | "published_at_readable">,
): string | null {
  if (blog.published_at_readable) {
    return blog.published_at_readable;
  }

  if (blog.published_at) {
    const parsed = new Date(blog.published_at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }

  return null;
}

function formatJobPostedDate(job: LatestJob): string | null {
  if (job.posted_at) {
    const parsed = new Date(job.posted_at);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }

  return null;
}

export default async function BlogDetailPage({ params }: BlogPageProps) {
  const { slug } = await params;
  const blog = await getBlog(slug);

  if (!blog) {
    notFound();
  }

  const latestBlogs = await getLatestBlogs(blog.slug);
  const filteredLatestBlogs = latestBlogs.filter(
    (item) => item.slug !== blog.slug,
  );
  const similarCategoryBlogs = blog.category?.slug
    ? await getSimilarCategoryBlogs(blog.category.slug, blog.slug)
    : [];
  const otherCategories = await getOtherCategories(blog.category?.slug ?? null);
  const latestJobs = await getLatestJobs();
  const similarCategoryHighlights = (() => {
    const highlights: Array<{
      categoryName: string;
      categorySlug: string | null;
      representative: SimilarCategoryBlog;
    }> = [];
    const seen = new Set<string>();

    for (const item of similarCategoryBlogs) {
      const categorySlug = item.category?.slug ?? `blog-${item.slug}`;

      if (seen.has(categorySlug)) {
        continue;
      }
        seen.add(categorySlug);
      highlights.push({
        categoryName: item?.title ?? "Related category",
        categorySlug: item?.slug ?? null,
        representative: item,
      });
    }

    return highlights.slice(0, 5);
  })();

  const shareUrl =
    blog.seo?.canonical_url ||
    `https://www.hrpostingpartner.com/blogs/${blog.slug}`;
  const formattedDate = formatPublishedDate(blog);
  const categoryHref = blog.category?.slug
    ? `/blogs/categories/${blog.category.slug}`
    : "/blogs";
  const shouldShowCategoryBackLink = Boolean(blog.category?.slug);
  const categoryLabel = blog.category?.name ?? "Blogs";
  const { sections: effectiveSections, adInsertionIndices } =
    prepareContentSections(blog.content_html, AD_MARKER);
  const adInsertionSet = new Set(adInsertionIndices);

  return (
    <article className="bg-gray-50 pb-16 pt-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="text-sm text-blue-600">
            <Link href="/blogs" className="font-semibold hover:text-blue-700">
              Blogs
            </Link>
            {blog.category?.name && (
              <>
                <span className="mx-2 text-gray-400">/</span>
                <span className="font-medium text-gray-500">
                  {blog.category.name}
                </span>
              </>
            )}
          </nav>

          {shouldShowCategoryBackLink && (
            <Link
              href={categoryHref}
              className="inline-flex items-center gap-2 self-start rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 hover:text-blue-700 sm:self-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to {categoryLabel}
            </Link>
          )}
        </div>

        <h1 className="mt-4 text-3xl font-bold text-gray-900 sm:text-4xl">
          {blog.title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          {blog.author?.name && (
            <span className="font-medium text-gray-700">
              By {blog.author.name}
            </span>
          )}
          {formattedDate && (
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-gray-400" />
              Published {formattedDate}
            </span>
          )}
          {blog.category?.name && (
            <span className="flex items-center gap-2 text-gray-500">
              <span className="h-1 w-1 rounded-full bg-gray-400" />
              {blog.category.name}
            </span>
          )}
          <BlogShareButton
            className="ml-auto"
            title={blog.title}
            url={shareUrl}
          />
        </div>

        {blog.image_url && (
          <div className="relative mt-8 overflow-hidden rounded-3xl bg-gray-200">
            <div className="relative aspect-[16/9] w-full lg:aspect-[21/9]">
              <Image
                src={blog.image_url}
                alt={blog.title}
                fill
                className=""
                sizes="(min-width: 1024px) 896px, 100vw"
                priority
              />
            </div>
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
          <div className="space-y-8">
            <div className="rounded-3xl bg-white p-6 shadow-sm sm:p-10">
              <div className="space-y-6 text-base leading-7 text-gray-700 [&_h2]:mt-10 [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:text-xl [&_img]:rounded-lg [&_img]:shadow [&_p]:text-gray-700 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6">
                {effectiveSections.map((section, index) => {
                  const shouldRenderContent = section.trim().length > 0;
                  const shouldRenderAd = adInsertionSet.has(index);

                  return (
                    <Fragment key={`blog-section-${index}`}>
                      {shouldRenderContent && (
                        <div
                          dangerouslySetInnerHTML={{ __html: section }}
                        />
                      )}
                      {shouldRenderAd && (
                        <div className="flex justify-center py-6">
                          <InArticleAd slotId="8015069158" />
                        </div>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-center">
              <Link
                href="/blogs"
                className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-6 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100"
              >
                Back to all blogs
              </Link>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                Latest blogs
              </h2>
              {filteredLatestBlogs.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">
                  Fresh posts will appear here soon. In the meantime, explore
                  more stories from our main blog hub.
                </p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {filteredLatestBlogs.map((item) => {
                    const publishedLabel = formatPublishedDate(item);

                    return (
                      <li
                        key={item.id}
                        className="group flex items-start gap-4 rounded-2xl bg-blue-50/50 p-3 transition hover:bg-blue-100/70"
                      >
                        {item.image_url && (
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-blue-100">
                            <Image
                              src={item.image_url}
                              alt={item.title}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-col gap-1">
                          {item.category?.name && (
                            <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                              {item.category.name}
                            </span>
                          )}
                          <Link
                            href={`/blogs/${item.slug}`}
                            className="line-clamp-2 text-sm font-semibold text-gray-900 transition group-hover:text-blue-700"
                          >
                            {item.title}
                          </Link>
                          {publishedLabel && (
                            <span className="text-xs text-gray-500">
                              {publishedLabel}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {similarCategoryHighlights.length > 0 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">
                  Explore similar categories
                </h2>
                <ul className="mt-4 space-y-4">
                  {similarCategoryHighlights.map(
                    ({ categoryName, categorySlug, representative }) => {
                      const categoryHref = categorySlug
                        ? `/blogs/categories/${categorySlug}`
                        : `/blogs/${representative.slug}`;
                      const publishedLabel =
                        formatPublishedDate(representative);

                      return (
                        <li
                          key={`${categorySlug ?? representative.slug}`}
                          className="group flex items-start gap-4 rounded-2xl bg-indigo-50/40 p-3 transition hover:bg-indigo-100/70"
                        >
                          {representative.image_url && (
                            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-indigo-100">
                              <Image
                                src={representative.image_url}
                                alt={categoryName}
                                fill
                                className="object-cover"
                                sizes="64px"
                              />
                            </div>
                          )}
                          <div className="flex min-w-0 flex-col gap-1">
                            <Link
                              href={categoryHref}
                              className="text-sm font-semibold text-gray-900 transition group-hover:text-indigo-700"
                            >
                              {categoryName}
                            </Link>
                            <p className="line-clamp-2 text-xs text-gray-600">
                              {representative.excerpt || representative.title}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-gray-500">
                              {publishedLabel && <span>{publishedLabel}</span>}
                              <Link
                                href={categoryHref}
                                className="inline-flex items-center gap-1 font-semibold text-indigo-600 transition hover:text-indigo-700"
                              >
                                View posts
                                <span aria-hidden="true">→</span>
                              </Link>
                            </div>
                          </div>
                        </li>
                      );
                    },
                  )}
                </ul>
              </div>
            )}

            {otherCategories.length > 0 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">
                  Other categories
                </h2>
                <ul className="mt-4 space-y-2 text-sm font-medium text-gray-700">
                  {otherCategories.map((category) => (
                    <li key={category.id}>
                      <Link
                        href={`/blogs/categories/${category.slug}`}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition hover:border-blue-200 hover:text-blue-700"
                      >
                        {category.name}
                        <span aria-hidden="true">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {latestJobs.length > 0 && (
              <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900">
                  Latest jobs
                </h2>
                <ul className="mt-4 space-y-4">
                  {latestJobs.map((job) => {
                    const postedLabel = formatJobPostedDate(job);
                    const location =
                      Array.isArray(job.locations) && job.locations.length > 0
                        ? job.locations[0]
                        : null;

                    return (
                      <li
                        key={job.id}
                        className="rounded-2xl border border-gray-100 bg-gray-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                      >
                        <div className="flex flex-col gap-2">
                          <Link
                            href={`/classified-jobs/${job.slug}`}
                            className="text-sm font-semibold text-gray-900 transition hover:text-blue-700"
                          >
                            {job.title}
                          </Link>
                          {job.short_description && (
                            <p className="line-clamp-3 text-xs text-gray-600">
                              {job.short_description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                            {location && <span>{location}</span>}
                            {postedLabel && <span>Posted {postedLabel}</span>}
                            <Link
                              href={`/classified-jobs/${job.slug}`}
                              className="inline-flex items-center gap-1 font-semibold text-blue-600 transition hover:text-blue-700"
                            >
                              View job
                              <span aria-hidden="true">&rarr;</span>
                            </Link>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                Follow other platforms for jobs
              </h2>
              <p className="mt-3 text-sm text-gray-600">
                Stay connected for daily job alerts across our official channels.
              </p>
              <ul className="mt-5 space-y-4 text-sm text-gray-700">
                <li>
                  <p className="font-medium text-gray-800">
                    Main WhatsApp Channel
                  </p>
                  <a
                    href="https://whatsapp.com/channel/0029VaRWeF7DDmFRZuX0Ww0K"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 underline hover:text-blue-800"
                  >
                    https://whatsapp.com/channel/0029VaRWeF7DDmFRZuX0Ww0K
                  </a>
                </li>
                <li>
                  <p className="font-medium text-gray-800">
                    Continuous Individual Job Ads → HRPP 2.0 WAC
                  </p>
                  <a
                    href="https://whatsapp.com/channel/0029VbAxrB572WTxgZBSbp1I"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 underline hover:text-blue-800"
                  >
                    https://whatsapp.com/channel/0029VbAxrB572WTxgZBSbp1I
                  </a>
                </li>
                <li>
                  <p className="font-medium text-gray-800">LinkedIn Page</p>
                  <a
                    href="https://www.linkedin.com/company/hr-posting-partner/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-blue-600 underline hover:text-blue-800"
                  >
                    https://www.linkedin.com/company/hr-posting-partner/
                  </a>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}
