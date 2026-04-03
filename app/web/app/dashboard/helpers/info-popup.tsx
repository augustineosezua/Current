import { X } from "lucide-react";

type InfoPopupProps = {
  props: {
    exit: () => void;
  };
};

export default function InfoPopup({ props }: InfoPopupProps) {
  return (
    <div className="absolute top-0 left-0 flex h-full w-full items-center justify-center">
      <div className="relative rounded-lg w-96 h-96 bg-white p-6 pt-12">
        <button
          type="button"
          onClick={props.exit}
          aria-label="Close popup"
          className="absolute right-4 top-4 text-gray-500 transition hover:cursor-pointer hover:text-gray-800"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-gray-800">This is the info popup content.</p>
      </div>
    </div>
  );
}
