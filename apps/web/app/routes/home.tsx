import type { MetaFunction } from 'react-router'

export const meta: MetaFunction = () => {
  return [
    { title: 'Chathouse - The open-source AI chat interface' },
    {
      name: 'description',
      content:
        'The open-source AI chat interface. Bring your own keys, connect any model, and start chatting.',
    },
  ]
}

export default function Home9() {
  return (
    <div className="min-h-screen bg-[#E5E5E5] font-sans text-[#111111] selection:bg-[#FF3366] selection:text-white">
      <div className="w-full overflow-hidden border-b-4 border-[#111] bg-[#111] py-2 text-white">
        <div className="flex animate-[marquee_20s_linear_infinite] gap-8 text-sm font-black tracking-widest whitespace-nowrap uppercase">
          <span>STOP PAYING SUBSCRIPTIONS</span>
          <span className="text-[#FF3366]">{'///'}</span>
          <span>BRING YOUR OWN API KEYS</span>
          <span className="text-[#FF3366]">{'///'}</span>
          <span>OWN YOUR DATA</span>
          <span className="text-[#FF3366]">{'///'}</span>
          <span>STOP PAYING SUBSCRIPTIONS</span>
          <span className="text-[#FF3366]">{'///'}</span>
          <span>BRING YOUR OWN API KEYS</span>
          <span className="text-[#FF3366]">{'///'}</span>
          <span>OWN YOUR DATA</span>
          <span className="text-[#FF3366]">{'///'}</span>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes marquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
      `,
        }}
      />

      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-8">
        <header className="mb-16 grid grid-cols-1 items-end gap-4 border-b-4 border-[#111] pb-8 md:grid-cols-4">
          <div className="md:col-span-2">
            <h1 className="text-6xl leading-[0.85] font-black tracking-tighter uppercase md:text-8xl lg:text-9xl">
              CHAT
              <br />
              <span className="text-[#FF3366]">HOUSE</span>
            </h1>
          </div>
          <div className="flex flex-col justify-end text-right md:col-span-1 md:text-left">
            <p className="mb-2 text-sm font-bold tracking-widest uppercase">Version</p>
            <p className="text-3xl font-black">1.0.0_OSS</p>
          </div>
          <div className="flex flex-col justify-end md:col-span-1">
            <a
              href="https://github.com/yourusername/chathouse"
              className="block w-full bg-[#111] py-4 text-center font-black tracking-widest text-white uppercase transition-colors hover:bg-[#FF3366]"
            >
              PULL REPOSITORY
            </a>
          </div>
        </header>

        <section className="mb-24 grid grid-cols-1 gap-8 border-b-4 border-[#111] pb-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="mb-8 text-4xl leading-[0.9] font-black tracking-tighter uppercase md:text-6xl">
              THE $60/MO PROBLEM. <br />
              SOLVED FOR $2.
            </h2>
            <div className="max-w-2xl space-y-6 text-xl leading-snug font-medium md:text-2xl">
              <p>
                You are currently paying OpenAI $20 a month. You are paying Anthropic $20 a month.
                You are paying Google $20 a month. Why? To access the same models you could access
                via their APIs for fractions of a penny per prompt.
              </p>
              <p className="inline-block bg-[#FF3366] p-2 font-black text-white">
                Chathouse changes the math entirely.
              </p>
              <p>
                It is a self-hosted, extremely resilient chat interface. You paste in your API keys
                once. You get access to every single state-of-the-art model on earth, in a single
                UI, completely under your control.
              </p>
            </div>
          </div>

          <div className="flex transform flex-col justify-center bg-[#111] p-8 text-white lg:col-span-5 lg:rotate-2">
            <h3 className="mb-6 text-3xl font-black text-[#FF3366] uppercase">
              System Architecture
            </h3>
            <ul className="space-y-4 font-mono text-sm">
              <li className="flex justify-between border-b border-white/20 pb-2">
                <span>FRONTEND</span>
                <span className="font-bold">React Router v7</span>
              </li>
              <li className="flex justify-between border-b border-white/20 pb-2">
                <span>DATABASE</span>
                <span className="font-bold">MySQL 8 + Prisma</span>
              </li>
              <li className="flex justify-between border-b border-white/20 pb-2">
                <span>BACKGROUND</span>
                <span className="font-bold">Redis + BullMQ</span>
              </li>
              <li className="flex justify-between border-b border-white/20 pb-2">
                <span>SECURITY</span>
                <span className="font-bold">TOTP 2FA + AES</span>
              </li>
              <li className="flex justify-between pt-2">
                <span>DEPLOYMENT</span>
                <span className="font-bold">Docker Compose</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-24">
          <div className="grid grid-cols-1 gap-px border-4 border-[#111] bg-[#111] md:grid-cols-2">
            {[
              {
                num: '01',
                title: 'MODEL AGNOSTIC',
                desc: 'Instantly swap between GPT-4, Claude 3.5, and Gemini mid-conversation. The interface abstracts the provider entirely.',
              },
              {
                num: '02',
                title: 'BULLMQ QUEUES',
                desc: 'Long prompt? Massive context? Hit send and close your laptop. The background worker processes it asynchronously. Never lose a response.',
              },
              {
                num: '03',
                title: 'IMMUTABLE SHARES',
                desc: 'Generate secure, public URLs for specific chat threads. Share your prompts and outputs without taking screenshots.',
              },
              {
                num: '04',
                title: 'ZERO TRUST',
                desc: 'No telemetry. No tracking. Complete isolation. Add TOTP Two-Factor Authentication to lock down your personal instance.',
              },
            ].map((f) => (
              <div
                key={f.num}
                className="group bg-[#E5E5E5] p-8 transition-colors duration-300 hover:bg-[#111] hover:text-white md:p-12"
              >
                <div
                  className="text-stroke bg-clip-text text-6xl font-black text-transparent transition-colors group-hover:text-[#FF3366] md:text-8xl"
                  style={{ WebkitTextStroke: '2px #111' }}
                >
                  {f.num}
                </div>
                <h3 className="mt-4 mb-4 text-3xl font-black tracking-tight uppercase md:text-4xl">
                  {f.title}
                </h3>
                <p className="text-lg leading-snug font-medium">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="cloud" className="mb-16 border-t-4 border-[#111] pt-16">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-5xl leading-[0.85] font-black tracking-tighter uppercase md:text-7xl">
                CAN'T BE BOTHERED TO HOST IT?
              </h2>
              <p className="text-2xl leading-snug font-medium">
                Docker is great, but maintaining servers is tedious. We are developing a fully
                managed cloud tier to sustain the open-source project. Get on the list.
              </p>
            </div>
            <div className="border-4 border-[#111] bg-[#FF3366] p-8 shadow-[16px_16px_0_0_#111] md:p-12">
              <h3 className="mb-8 text-3xl font-black tracking-tight text-white uppercase">
                JOIN CLOUD WAITLIST
              </h3>
              <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="EMAIL_ADDRESS@"
                  className="w-full border-2 border-transparent bg-[#111] p-6 font-mono text-xl text-white placeholder-white/50 focus:border-white focus:outline-none"
                  required
                />
                <button className="w-full border-2 border-transparent bg-white py-6 text-2xl font-black text-[#111] uppercase transition-colors hover:bg-[#111] hover:text-white">
                  SECURE ACCESS
                </button>
              </form>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
