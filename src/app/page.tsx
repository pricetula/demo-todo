import { TimelineContainer } from "@/features/todo-timeline/components/timeline-container";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col py-16 px-16 bg-white dark:bg-black sm:items-start">
        <TimelineContainer />
      </main>
    </div>
  );
}
