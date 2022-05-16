import React, { useEffect } from "react"

const Project = ({ data }) => {
    useEffect(() => {
        
    }, [])

    return (
        <div className="project bg-danger text-white m-2 p-2">
            <div className="noselect py-2">
                <h3 className="py-2">{data.project_title}</h3>
                <img src={data.image} className="project img-fluid p-2"></img>
                <p>{data.description}</p>
            </div>
        </div>
    )
}

export default Project