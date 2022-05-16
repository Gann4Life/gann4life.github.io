import React, { useEffect } from "react"
import HighlightedTechnologies from "./HighightedTechnologies"

const Project = ({ data }) => {
    useEffect(() => {
        
    }, [])

    return (
        <a href={data.link_to_project} className="project interactable text-decoration-none bg-dark text-white m-2 p-2">
            <div className="noselect py-2">
                <div className="d-flex justify-content-around">
                    <h3 className="py-2">{data.project_title}</h3>
                    <p className="text-muted my-auto">{data.start_date} - {data.is_current?"Present":data.end_date}</p>
                </div>
                
                {data.link_to_source_code != null
                ?<a 
                className="text-white text-decoration-none" 
                href={data.link_to_source_code}>
                    <p className="interactable bg-danger rounded-pill">Source Code</p>
                </a>
                :""}

                {<img src={data.image} className="project img-fluid p-2"></img>}

                {<p>{data.description}</p>}

                <hr></hr>

                <HighlightedTechnologies main_tech={data.highlighted_technologies} other_tech={data.other_technologies}/>
            </div>
        </a>
    )
}

export default Project