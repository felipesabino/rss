type ReactHelloProps = {
  message?: string;
};

export default function ReactHello({ message = "React island ready" }: ReactHelloProps) {
  return (
    <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-3 text-sm text-gray-700">
      {message}
    </div>
  );
}
