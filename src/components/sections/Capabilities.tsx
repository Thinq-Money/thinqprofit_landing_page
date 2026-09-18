import Container from '../ui/Container'
import CardSlider3D from '../ui/CardSlider3D'
import { capabilitiesIntro, capabilityCards } from '../../data/capabilities'

/**
 * §4 — the rest of the terminal.
 *
 * Interactive 3D horizontal card slider that continuously drifts and can be dragged.
 */
export default function Capabilities() {
  return (
    <section id="capabilities" className="relative w-full isolate pt-10 pb-16 lg:pt-16 lg:pb-24">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="display-lead font-display text-4xl lg:text-5xl font-bold tracking-tight text-fg">
            {capabilitiesIntro.heading}
          </h2>
          {capabilitiesIntro.subheading ? (
            <p className="mt-3 text-base lg:text-lg text-fg-muted max-w-xl mx-auto leading-relaxed">
              {capabilitiesIntro.subheading}
            </p>
          ) : null}
        </div>
      </Container>

      {/* 3D Horizontal Image Slider covering full width */}
      <div className="-mx-4 sm:-mx-8 lg:-mx-16 xl:-mx-24 overflow-visible py-8">
        <CardSlider3D items={capabilityCards} cardWidth="16.5em" direction="right" />
      </div>
    </section>
  )
}
