# Bloom by Project Budline

Bloom is a study and wellbeing companion for secondary school students. This folder is the whole website.

| File | What it is |
|---|---|
| `index.html` | The app. Rebuild it from `../budline.html` with `../build.ps1` after editing. |
| `config.js` | Your Supabase settings (public values only). |
| `netlify/functions/ai.mjs` | The server function that talks to the AI. Your API key stays here on Netlify, never in the browser. |
| `supabase/schema.sql` | Database setup: private storage per student and a daily AI limit. |
| `netlify.toml`, `package.json` | Tell Netlify how to deploy. |
| `favicon.png` | The Project Budline logo. |

Bloom works in three levels. Each one builds on the last, and you can stop at any of them.

| Level | What students get | What you need |
|---|---|---|
| 1. Static site | Everything, saved on each student's own device. AI shows labelled example replies. | Nothing extra |
| 2. Accounts | Sign up with email and password, data saved privately and available on any device | A free Supabase project |
| 3. Live AI | Study helper, Task helper, AI step suggestions and AI mood reflection | An Anthropic API key (paid, per use) |

Because Bloom is for under-18s, get your school's OK before turning on levels 2 and 3. A teacher or parent should own the Netlify, Supabase and Anthropic accounts.

---

## Step 1: Put the site on GitHub and Netlify

Netlify's drag-and-drop page can't run the AI function, so connect it through GitHub instead. No coding tools are needed; it all happens in the browser.

1. Sign in at https://github.com and click **New repository**. Name it `bloom`, choose **Private** or **Public**, and click **Create repository**.
2. On the new repository page click **uploading an existing file**. Open this `bloom-site` folder, select **everything inside it** (including the `netlify` and `supabase` folders) and drag it onto the page. Click **Commit changes**.
3. Sign in at https://app.netlify.com and choose **Add new site → Import an existing project → GitHub**, then pick your `bloom` repository.
4. Leave the build settings as Netlify fills them in (publish directory `.`, no build command) and click **Deploy**.
5. Netlify gives you a link like `https://bloom-budline.netlify.app`. You can rename it under **Site configuration → Change site name**.

At this point Bloom is live at level 1.

To update the site later: run `build.ps1`, then upload the changed files to GitHub the same way. Netlify redeploys automatically.

## Step 2: Turn on accounts (Supabase)

1. Create a free project at https://supabase.com. Pick a strong database password and a region near your students.
2. Open **SQL Editor → New query**, paste in the whole of `supabase/schema.sql` and click **Run**.
3. Open **Authentication → URL Configuration**. Set **Site URL** to your Netlify link, and add the same link under **Redirect URLs**. This makes the confirmation and password-reset emails send students back to Bloom.
4. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
5. Put them in `config.js`:
   ```js
   supabaseUrl: "https://YOUR-PROJECT.supabase.co",
   supabaseAnonKey: "YOUR-ANON-KEY",
   ```
   Then upload the new `config.js` to GitHub.

The anon key is designed to be public. Row-level security in `schema.sql` is what stops anyone reading another student's data. Never put the **service_role** key in `config.js`.

Students can now tap **Create a Bloom account** during setup or in Settings. New accounts get an email to confirm their address before they can sign in.

## Step 3: Turn on live AI (Anthropic)

1. Create an account at https://console.anthropic.com, add billing, and create an **API key**. Set a monthly spend limit there too.
2. In Netlify open **Site configuration → Environment variables** and add:

   | Key | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | your API key |
   | `SUPABASE_URL` | the same Project URL as in `config.js` |
   | `SUPABASE_ANON_KEY` | the same anon key as in `config.js` |
   | `BLOOM_AI_DAILY_LIMIT` | optional, messages per student per day (default `40`) |
   | `BLOOM_MODEL` | optional, the Claude model to use (default `claude-opus-5-5`) |

3. Go to **Deploys → Trigger deploy → Deploy site** so the function picks up the new variables.

The AI helpers only answer signed-in students. Each message checks their sign-in and adds one to their daily count. Students who aren't signed in keep getting the labelled example replies.

How the function keeps things safe:
- The API key stays on Netlify and never reaches the browser.
- A fixed safety instruction goes with every request: be age-appropriate, never diagnose, never ask for personal details, and point to a trusted adult if a student might be in danger.
- Messages that mention self-harm or danger get a calm support message straight away, without going to the AI.
- Replies are capped in length, and each request is limited to about 30,000 characters.
- The default model is `claude-opus-5-5` at low effort, which keeps answers quick. The function also turns on Anthropic's automatic fallback for requests the model declines. If replies are slow or cost more than you want, set `BLOOM_MODEL` to `claude-haiku-5-5`.

## Before sharing with students

- Fill in real school support contacts on the Support page. Ask your school to review and add local helplines.
- Ask your school whether parental consent is needed for students under 16 (or the age that applies where you are). Sign-up asks students to confirm they're 13 or older and that a parent or carer knows if they're under 18.
- "Delete everything" in Settings removes a student's Bloom data. To remove their login completely, delete the user in Supabase under **Authentication → Users**. This also deletes their data.
- Bloom is a wellbeing and study tool. It isn't an emergency or counselling service, and the app says so on every page.
