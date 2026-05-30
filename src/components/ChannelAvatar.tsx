type Props = {
    channelId: string;
    channelName: string;
    size?: number;
};

export default function ChannelAvatar({ channelId, channelName, size = 40 }: Props) {
    return (
        <img
            src={`/api/channel/avatar/${channelId}`}
            alt={channelName}
            width={size}
            height={size}
            className="rounded-full object-cover bg-gray-100"
            style={{ width: size, height: size }}
            onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.style.display = "none";
                const parent = el.parentElement;
                if (parent && !parent.querySelector("span")) {
                    const span = document.createElement("span");
                    span.textContent = channelName.charAt(0).toUpperCase();
                    span.className = "flex items-center justify-center rounded-full bg-gray-200 text-gray-600 font-medium";
                    span.style.width = `${size}px`;
                    span.style.height = `${size}px`;
                    span.style.fontSize = `${Math.round(size * 0.4)}px`;
                    parent.appendChild(span);
                }
            }}
        />
    );
}
