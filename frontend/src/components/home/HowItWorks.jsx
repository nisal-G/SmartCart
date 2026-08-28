import { Icon } from '../ui/Icon';
import { Reveal } from '../motion/Reveal';
import { SectionHeading } from '../ui/SectionHeading';

// The app's actual flow, in order: browse -> cart -> PayHere -> orders.
// Nothing here describes a step SmartCart doesn't really have.
const STEPS = [
  {
    icon: 'search',
    title: 'Find what you need',
    body: 'Search the catalogue or filter by category to get to the right shelf in one tap.',
  },
  {
    icon: 'cart',
    title: 'Build your cart',
    body: 'Set quantities and review your total. Your cart is saved to your account as you go.',
  },
  {
    icon: 'shield',
    title: 'Pay and track',
    body: 'Check out through PayHere, then follow the order and payment status from your account.',
  },
];

/** Three-step explainer for the homepage: how an order actually works here. */
export function HowItWorks() {
  return (
    <section className="pt-16 sm:pt-24">
      <Reveal variant="up">
        <SectionHeading
          align="center"
          eyebrow="How it works"
          title="From shelf to doorstep in three steps"
          description="No accounts to configure and no setup — sign in, fill your cart and pay."
        />
      </Reveal>

      <ol className="mt-10 grid gap-5 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step, index) => (
          <Reveal key={step.title} variant="up" delay={index * 90} className="h-full">
            <li className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-panel border border-slate-200/80 bg-white p-6 shadow-card transition-[box-shadow,transform,border-color] duration-300 ease-entrance hover:-translate-y-1 hover:border-brand-200 hover:shadow-lift sm:p-7">
              {/* Step number, sitting behind the content as a watermark. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-2 -top-4 text-7xl font-extrabold text-slate-100 transition-colors duration-300 group-hover:text-brand-50"
              >
                {index + 1}
              </span>

              <span
                className="relative flex h-12 w-12 items-center justify-center rounded-control bg-brand-600 text-white shadow-brand transition-transform duration-300 ease-entrance group-hover:scale-105"
                aria-hidden="true"
              >
                <Icon name={step.icon} size="lg" />
              </span>

              <div className="relative min-w-0">
                <h3 className="text-base font-bold text-slate-900 sm:text-lg">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
