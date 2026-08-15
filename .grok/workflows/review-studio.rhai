// review-studio: quality gate after a studio slice. Does not generate the site.
// Args: optional { "slice": "foundation" | "library" | "atlas" | "polish" }

let meta = #{
    name: "review-studio",
    description: "Review the personal AI studio site for IA, editorial voice, craft, and ship config. Adversarially verify every finding.",
    when_to_use: "After a studio slice is implemented, before calling it done or pushing to GitHub Pages",
    phases: [
        #{ title: "Review", detail: "IA, editorial, craft, ship — in parallel" },
        #{ title: "Verify", detail: "Independent skeptics must confirm each finding" },
    ],
};

let findings_schema = #{
    "type": "object",
    "required": ["findings"],
    "properties": #{
        "findings": #{
            "type": "array",
            "maxItems": 8,
            "items": #{
                "type": "object",
                "required": ["file", "issue", "severity"],
                "properties": #{
                    "file": #{ "type": "string" },
                    "issue": #{ "type": "string" },
                    "severity": #{ "type": "string" },
                },
            },
        },
    },
};

let verdict_schema = #{
    "type": "object",
    "required": ["real", "reason", "evidence"],
    "properties": #{
        "real": #{ "type": "boolean" },
        "reason": #{ "type": "string" },
        "evidence": #{ "type": "string" },
    },
};

let slice = "foundation";
if args != () && args.slice != () {
    slice = args.slice;
}

let contract = "";
contract += "This is Arunveer Singh's personal AI studio (Astro + MDX, GitHub Pages). ";
contract += "Not a resume, not a SaaS landing page, not a default Astro/Geist/bento portfolio. ";
contract += "Content types: essays, videos (Watch), builds, signals, then a topic atlas. ";
contract += "Identity: github.com/arunveersingh, linkedin.com/in/arunveersingh, ";
contract += "youtube.com/@oopsfeedmecode, youtube.com/@developernoteshindi, x.com/oopsfeedmecode. ";
contract += "Git author must be arunveersingh / arunveersingh9@gmail.com — never the SBS work email. ";
contract += "Do not revive TechCreatorPortfolio or the old site repo. ";
contract += "Current slice: " + slice + ". ";
contract += "Judge only what this slice promised. Foundation = scaffold, collections, routes, Pages Action, empty-but-honest layouts. ";
contract += "Library = imported articles + featured builds + video stubs + homepage thesis. ";
contract += "Atlas = topic pages that stitch artifacts. Polish = type, RSS, domain.";

let inspect = "";
inspect += "Use read_file, grep, and list_dir on the workspace. Do not answer from memory. ";
inspect += "Read astro.config, package.json, src/pages, src/content, src/layouts, .github/workflows, and git config. ";
inspect += "An empty findings list is valid only after you have actually opened those files. ";
inspect += "severity must be one of: blocker, major, minor. ";
inspect += "file must be a real path you opened. issue must be specific and actionable.";

phase("Review");

let jobs = [];

let p_ia = "";
p_ia += "Review information architecture for this personal studio. " + contract + inspect;
p_ia += " Check: routes exist for /, /essays, /watch, /builds, /atlas, /about; ";
p_ia += "four content collections (essays, videos, builds, signals); ";
p_ia += "homepage is a point of view, not a bio or repo grid; ";
p_ia += "no CMS, database, chatbot, or auto-ingest of every GitHub repo.";
jobs.push(#{
    prompt: p_ia,
    label: "review:ia",
    capability_mode: "read-only",
    output_schema: findings_schema,
});

let p_ed = "";
p_ed += "Review editorial voice and copy. " + contract + inspect;
p_ed += " Check: no lorem ipsum; no generic 'Passionate developer' copy; ";
p_ed += "empty states are honest; About is a thesis, not a CV dump; ";
p_ed += "YouTube/LinkedIn/GitHub links that exist are the canonical ones; ";
p_ed += "articles and the ai repo are treated as inputs, not ignored if this slice includes library.";
jobs.push(#{
    prompt: p_ed,
    label: "review:editorial",
    capability_mode: "read-only",
    output_schema: findings_schema,
});

let p_cr = "";
p_cr += "Review visual craft and accessibility. " + contract + inspect;
p_cr += " Check: not a default Astro/Tailwind/shadcn portfolio; ";
p_cr += "real typography hierarchy; readable measure (line length); ";
p_cr += "color contrast; focus states; semantic headings; works as a document, not a dashboard.";
jobs.push(#{
    prompt: p_cr,
    label: "review:craft",
    capability_mode: "read-only",
    output_schema: findings_schema,
});

let p_sh = "";
p_sh += "Review ship/config. " + contract + inspect;
p_sh += " Check: GitHub Pages workflow builds Astro and publishes dist; ";
p_sh += "package.json scripts (dev, build, preview); astro site/base config is coherent; ";
p_sh += "local git user.email is arunveersingh9@gmail.com if a repo exists; ";
p_sh += "no SBS work email in repo files; .gitignore covers node_modules and dist.";
jobs.push(#{
    prompt: p_sh,
    label: "review:ship",
    capability_mode: "read-only",
    output_schema: findings_schema,
});

let results = parallel(jobs);

let findings = [];
for r in results {
    if r != () && r.success && r.output.findings != () {
        for f in r.output.findings {
            findings.push(f);
        }
    }
}

if findings.len() == 0 {
    complete(#{
        summary: "No findings after four reviewers on slice " + slice + ".",
        slice: slice,
        confirmed: [],
    });
}

log(findings.len().to_string() + " raw findings — verifying");

phase("Verify");
let vjobs = [];
for f in findings {
    let vp = "";
    vp += "Adversarially verify this review finding by reading the shipped files. ";
    vp += "Finding: \"" + f.issue + "\" in " + f.file + " (severity " + f.severity + "). ";
    vp += "Use read_file/grep. Set real=true only with concrete evidence you independently inspected. ";
    vp += "If the slice is " + slice + " and the finding demands later-slice work, set real=false. ";
    vp += "Otherwise default real=false.";
    vjobs.push(#{
        prompt: vp,
        label: "verify:" + f.file,
        capability_mode: "read-only",
        output_schema: verdict_schema,
    });
}
let verdicts = parallel(vjobs);

let confirmed = [];
let i = 0;
for v in verdicts {
    if v != () && v.success && v.output.real == true
        && v.output.evidence != () && v.output.evidence != "" {
        confirmed.push(findings[i]);
    }
    i += 1;
}

log(confirmed.len().to_string() + "/" + findings.len().to_string() + " findings survived verification");
complete(#{
    summary: confirmed.len().to_string() + " confirmed findings on slice " + slice,
    slice: slice,
    confirmed: confirmed,
});
