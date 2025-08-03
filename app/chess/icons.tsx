interface IconProps {
    name: string;
    rating: number;
    isWhite: boolean;
}

export const Icon = (  { name, rating, isWhite } : IconProps) => {
    return (
        <div className="flex items-center space-x-2">
            {/* {isWhite ? (
                <img src="/icons/white-icon.png" alt="White Icon" className="w-6 h-6" />
            ) : (
                <img src="/icons/black-icon.png" alt="Black Icon" className="w-6 h-6" />
            )} - add this later */}

            <img src="default_icon.jpg" alt="profile picture" className="w-8 h-8"></img>

            <div className="items-center">
                <h1 className="text-lg"> { name } </h1>
                <p className="text-sm text-gray-500">Rating: { rating }</p>
            </div>
        </div>
    )
}