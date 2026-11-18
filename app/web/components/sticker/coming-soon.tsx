// Stands in for the web app pages while Current is iPhone-only. Web access for Plus is on the roadmap (3.7).
import Link from "next/link";

import { APP_STORE_URL, StickerSite, Sticker } from "./site";

export function ComingSoon() {
  return (
    <StickerSite>
      <section className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-8 flex items-end">
          <Sticker emoji="💻" fill="--st-sky" size={72} tilt={-6} />
          <span className="-ml-3 -mb-2">
            <Sticker emoji="⏳" fill="--st-butter" size={56} tilt={5} />
          </span>
        </div>

        <h1 className="st-display text-4xl sm:text-5xl">Coming to the web soon</h1>
        <p className="mt-4 max-w-md text-lg text-[var(--st-muted)]">
          Right now Current lives on your iPhone. No account, no bank login, and your budget stays on your phone.
          A web version is on the way for Plus.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <a href={APP_STORE_URL} className="st-button rounded-full px-6 py-3 font-extrabold">
            Get the iPhone app
          </a>
          <Link
            href="/support"
            className="rounded-full bg-[var(--st-field)] px-6 py-3 font-extrabold"
          >
            Help and support
          </Link>
        </div>
      </section>
    </StickerSite>
  );
}
