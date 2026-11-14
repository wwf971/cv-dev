import { useEffect, useRef } from 'react';
import { ImageUp } from 'lucide-react';
import './CvJp.css';

// An image given to a CV: the photo of the form, the image of a badge. A button choosing a
// file (never the bare file field of the browser, which has no border and says its own words
// in the language of the system), and, while it is shown, an image pasted anywhere on the page
// (Ctrl/⌘ + V): a screenshot or a copied picture is the usual way an image arrives.
//
//   label            what the button says
//   sizeMax          the longer side the image is scaled down to, in px
//   isPasteTaken     an image pasted while this is shown is taken (default true)
//   onImage(dataUrl) the image, small enough to live in a data item as text
//   onProblem(text)  what was given is no image
export function CvJpImagePick({ label = 'Choose an image…', sizeMax = 800, isPasteTaken = true, isDisabled = false, onImage, onProblem }) {
	const inputRef = useRef(null);
	const onImageRef = useRef(onImage);
	onImageRef.current = onImage;
	const onProblemRef = useRef(onProblem);
	onProblemRef.current = onProblem;
	const take = async (file) => {
		if (!file) return;
		try {
			onImageRef.current?.(await cvJpImageRead(file, sizeMax));
		} catch (error) {
			onProblemRef.current?.(String(error?.message ?? error));
		}
	};
	const takeRef = useRef(take);
	takeRef.current = take;

	useEffect(() => {
		if (!isPasteTaken || isDisabled) return undefined;
		// before the surface of the cell, which would paste the clipboard's text
		const pasteHandle = (event) => {
			const file = [...(event.clipboardData?.files ?? [])].find((one) => one.type.startsWith('image/'));
			if (!file) return;
			event.preventDefault();
			event.stopPropagation();
			void takeRef.current(file);
		};
		document.addEventListener('paste', pasteHandle, true);
		return () => document.removeEventListener('paste', pasteHandle, true);
	}, [isPasteTaken, isDisabled]);

	return (
		<span className="doc-cv-jp-image-pick">
			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				hidden
				tabIndex={-1}
				aria-hidden="true"
				onChange={(event) => {
					void take(event.target.files?.[0]);
					event.target.value = '';
				}}
			/>
			<button type="button" className="doc-button" disabled={isDisabled} onClick={() => inputRef.current?.click()}>
				<ImageUp size={12} aria-hidden="true" /><span>{label}</span>
			</button>
			{isPasteTaken ? <span className="doc-cv-jp-editor-hint">or paste one: Ctrl/⌘ + V</span> : null}
		</span>
	);
}

// the image of a file as a data url, scaled down so that it can be kept as text in a data
// item. a vector image is kept as it is; a picture with transparency stays a png
export function cvJpImageRead(file, sizeMax = 800) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('the file could not be read'));
		reader.onload = () => {
			const source = String(reader.result);
			if (file.type === 'image/svg+xml') {
				resolve(source);
				return;
			}
			const image = new Image();
			image.onerror = () => reject(new Error('the file is not an image'));
			image.onload = () => {
				const scale = Math.min(1, sizeMax / Math.max(image.width, image.height));
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(image.width * scale);
				canvas.height = Math.round(image.height * scale);
				canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
				resolve(file.type === 'image/png' ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.88));
			};
			image.src = source;
		};
		reader.readAsDataURL(file);
	});
}
