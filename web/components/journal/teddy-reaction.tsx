import type { TeddyReaction as TeddyReactionType } from "@/lib/teddy-reaction";

type TeddyReactionProps = {
  reaction: TeddyReactionType | null;
};

const REACTION_COPY: Record<
  TeddyReactionType,
  { eyebrow: string; message: string }
> = {
  happy: {
    eyebrow: "A bright moment",
    message: "Holding onto this bright moment with you.",
  },
  calm: {
    eyebrow: "A quiet check-in",
    message: "Thank you for taking a moment to check in.",
  },
  supportive: {
    eyebrow: "A gentle reminder",
    message: "Be gentle with yourself today.",
  },
};

export function TeddyReaction({ reaction }: TeddyReactionProps) {
  if (!reaction) return null;

  const copy = REACTION_COPY[reaction];

  return (
    <aside className={`teddy-reaction teddy-reaction--${reaction}`}>
      <div className="teddy-reaction__illustration" aria-hidden="true">
        <svg viewBox="0 0 220 220" className="teddy-reaction__svg">
          <g className="teddy-reaction__bear">
            <circle className="teddy-reaction__ear" cx="62" cy="55" r="30" />
            <circle className="teddy-reaction__ear" cx="158" cy="55" r="30" />
            <circle className="teddy-reaction__ear-inner" cx="62" cy="55" r="16" />
            <circle className="teddy-reaction__ear-inner" cx="158" cy="55" r="16" />
            <ellipse className="teddy-reaction__body" cx="110" cy="159" rx="61" ry="55" />
            <circle className="teddy-reaction__head" cx="110" cy="91" r="65" />

            <g className="teddy-reaction__face">
              <circle className="teddy-reaction__eye" cx="84" cy="82" r="5" />
              <circle className="teddy-reaction__eye" cx="136" cy="82" r="5" />
              <ellipse className="teddy-reaction__cheek" cx="72" cy="103" rx="11" ry="6" />
              <ellipse className="teddy-reaction__cheek" cx="148" cy="103" rx="11" ry="6" />
              <ellipse className="teddy-reaction__muzzle" cx="110" cy="105" rx="29" ry="23" />
              <path className="teddy-reaction__nose" d="M102 98 Q110 92 118 98 Q117 106 110 107 Q103 106 102 98Z" />
              <path className="teddy-reaction__mouth teddy-reaction__mouth--happy" d="M110 107 C107 120 92 120 91 110 M110 107 C113 120 128 120 129 110" />
              <path className="teddy-reaction__mouth teddy-reaction__mouth--calm" d="M99 114 Q110 119 121 114" />
              <path className="teddy-reaction__mouth teddy-reaction__mouth--supportive" d="M99 117 Q110 108 121 117" />
            </g>

            <ellipse className="teddy-reaction__belly" cx="110" cy="165" rx="35" ry="34" />
            <ellipse className="teddy-reaction__arm teddy-reaction__arm--left" cx="56" cy="151" rx="19" ry="42" transform="rotate(24 56 151)" />
            <ellipse className="teddy-reaction__arm teddy-reaction__arm--right" cx="164" cy="151" rx="19" ry="42" transform="rotate(-24 164 151)" />
            <ellipse className="teddy-reaction__foot" cx="78" cy="197" rx="28" ry="17" />
            <ellipse className="teddy-reaction__foot" cx="142" cy="197" rx="28" ry="17" />

            <g className="teddy-reaction__heart">
              <path d="M110 181 C94 168 85 159 85 148 C85 137 98 132 110 144 C122 132 135 137 135 148 C135 159 126 168 110 181Z" />
            </g>
          </g>

          <g className="teddy-reaction__sparkles">
            <path d="M34 78 L38 89 L49 93 L38 97 L34 108 L30 97 L19 93 L30 89Z" />
            <path d="M181 48 L184 57 L193 60 L184 63 L181 72 L178 63 L169 60 L178 57Z" />
            <circle cx="185" cy="107" r="5" />
          </g>

          <g className="teddy-reaction__calm-lines">
            <path d="M174 72 C186 66 193 68 200 75" />
            <path d="M176 83 C186 79 193 81 198 87" />
          </g>
        </svg>
      </div>

      <div className="teddy-reaction__copy">
        <p className="teddy-reaction__eyebrow">{copy.eyebrow}</p>
        <p className="teddy-reaction__message">{copy.message}</p>
      </div>
    </aside>
  );
}
