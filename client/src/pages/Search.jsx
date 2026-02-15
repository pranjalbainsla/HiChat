import React, { useState } from "react";
import searchIcon from "../assets/search.svg";

const Search = ( { query, setQuery }) => {
    //const [searchInput, setSearchInput] = useState("")

    return (
        <div className="search-box">
            
            <input 
                type="text"
                placeholder="search..."
                value={query}
                onChange={(e)=>setQuery(e.target.value)}
                onKeyDown={(e)=> {
                    if (e.key === 'Enter') {
                        setQuery(query);
                    }
                }}
                className="search-bar"
            />
            <button aria-label="search-button" className="search-button" onClick={()=>setQuery(query)}><img src={searchIcon} alt="search icon" /></button>
          
        </div>
    )
}

export default Search