export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-500">
            &copy; {new Date().getFullYear()} Zdrovite. Wszystkie prawa
            zastrzeżone.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Regulamin
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Polityka prywatności
            </a>
            <a href="#" className="text-sm text-gray-500 hover:text-gray-700 transition">
              Kontakt
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
