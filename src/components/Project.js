import React from "react"
import HighlightedTechnologies from "./HighightedTechnologies"

const Project = ({ data }) => {
    return (
        <div href={data.link_to_project} className="col-lg-5 project shadow text-decoration-none bg-dark text-white m-2 p-2">
            <div className="noselect py-2">
                <div className="d-flex justify-content-around">
                    <div>
                        <h3>{data.project_title}</h3>
                        <p className="text-muted"><i>{data.role}</i></p>
                    </div>
                    <p className="text-muted"><i>
                        {data.start_date === data.end_date ?
                        <p>{data.end_date}</p>
                        :<p>{data.start_date} - {data.is_current ? "Present" : data.end_date}</p>}
                    </i></p>
                </div>
                
                <div className="d-flex justify-content-around">
                    {data.link_to_project != null
                    ?<a className="text-white text-decoration-none mx-2 w-100" href={data.link_to_project}>
                        <p className="interactable bg-danger rounded-pill">View project</p>
                    </a>:""}

                    {data.link_to_source_code != null
                    ?<a className="text-white text-decoration-none mx-2 w-100" href={data.link_to_source_code}>
                        <p className="interactable bg-danger rounded-pill">Source Code</p>
                    </a>:""}
                </div>

                {data.image ? <img alt="Project thumbnail" src={data.image} className="project img-fluid p-2"/> : ""}

                {<p>{data.description}</p>}

                <hr></hr>

                <HighlightedTechnologies main_tech={data.highlighted_technologies} other_tech={data.other_technologies}/>
            </div>
        </div>
    )
}

export default Project